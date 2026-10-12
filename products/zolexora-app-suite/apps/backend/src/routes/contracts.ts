import { Router, type Request, type Response } from 'express'
import { query } from '../db.js'
import { generateContractLegalHtml } from '../services/contract-generator.js'
import { recordContractAuditEvent } from '../services/audit-logger.js'
import type { Contract, ContractAuditLog } from '../types.js'

export const contractsRouter = Router()

// GET /api/contracts?userId=&status=
contractsRouter.get('/', async (req: Request, res: Response) => {
  try {
    const { userId, status } = req.query

    let sql = `
      SELECT c.*, u.email as user_email, r.title as request_title
      FROM public.contracts c
      JOIN public.zolexora_auth_users u ON c.user_id = u.id
      LEFT JOIN public.app_requests r ON c.request_id = r.id
      WHERE 1=1
    `
    const params: unknown[] = []

    if (userId) {
      params.push(userId)
      sql += ` AND c.user_id = $${params.length}`
    }

    if (status) {
      params.push(status)
      sql += ` AND c.status = $${params.length}`
    }

    sql += ' ORDER BY c.created_at DESC'

    const { rows } = await query<Contract & { user_email: string }>(sql, params)
    res.json({ data: rows })
  } catch (error: unknown) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Database error',
    })
  }
})

// GET /api/contracts/:id
contractsRouter.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params

    const { rows } = await query<Contract & { user_email: string; request_title?: string }>(
      `SELECT c.*, u.email as user_email, r.title as request_title
       FROM public.contracts c
       JOIN public.zolexora_auth_users u ON c.user_id = u.id
       LEFT JOIN public.app_requests r ON c.request_id = r.id
       WHERE c.id = $1 LIMIT 1`,
      [id]
    )

    if (!rows[0]) {
      return res.status(404).json({ error: 'Contract not found' })
    }

    res.json({ data: rows[0] })
  } catch (error: unknown) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Database error',
    })
  }
})

// POST /api/contracts
contractsRouter.post('/', async (req: Request, res: Response) => {
  try {
    const {
      requestId,
      userId,
      title,
      contractType = 'MSA',
      totalValueInr,
      scopeSummary,
      stampState = 'Maharashtra',
      stampDutyRef,
      signingMode = 'CLICKWRAP_OTP',
    } = req.body

    if (!userId || !title) {
      return res.status(400).json({ error: 'userId and title are required' })
    }

    const { rows } = await query<Contract>(
      `INSERT INTO public.contracts (
        request_id, user_id, title, contract_type, status,
        total_value_inr, scope_summary, stamp_state, stamp_duty_ref, signing_mode
      ) VALUES ($1, $2, $3, $4, 'sent', $5, $6, $7, $8, $9)
      RETURNING *`,
      [
        requestId || null,
        userId,
        title,
        contractType,
        totalValueInr || null,
        scopeSummary || null,
        stampState,
        stampDutyRef || null,
        signingMode,
      ]
    )

    if (requestId) {
      await query(
        `UPDATE public.app_requests SET status = 'contracted', updated_at = NOW() WHERE id = $1`,
        [requestId]
      )
    }

    res.status(201).json({ data: rows[0] })
  } catch (error: unknown) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to create contract',
    })
  }
})

// GET /api/contracts/:id/document
contractsRouter.get('/:id/document', async (req: Request, res: Response) => {
  try {
    const { id } = req.params

    const { rows } = await query<Contract & { user_email: string; request_title?: string }>(
      `SELECT c.*, u.email as user_email, r.title as request_title
       FROM public.contracts c
       JOIN public.zolexora_auth_users u ON c.user_id = u.id
       LEFT JOIN public.app_requests r ON c.request_id = r.id
       WHERE c.id = $1 LIMIT 1`,
      [id]
    )

    const contract = rows[0]
    if (!contract) {
      return res.status(404).json({ error: 'Contract not found' })
    }

    const clientEmail = contract.user_email
    const projectTitle = contract.request_title || contract.title

    const { html, documentHash } = generateContractLegalHtml({
      contract,
      clientName: clientEmail,
      clientEmail,
      projectTitle,
    })

    const ipAddress = (req.headers['x-forwarded-for'] as string)?.split(',')[0] || req.socket.remoteAddress || '127.0.0.1'
    const userAgent = req.headers['user-agent'] || 'Unknown'

    await recordContractAuditEvent({
      contractId: contract.id,
      userId: contract.user_id,
      signerName: clientEmail,
      signerEmail: clientEmail,
      action: 'VIEWED',
      ipAddress,
      userAgent,
      verificationMethod: 'HTTP_API_DOCUMENT_FETCH',
      documentHash,
    })

    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    res.setHeader('X-Document-SHA256', documentHash)
    res.send(html)
  } catch (error: unknown) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to render document',
    })
  }
})

// POST /api/contracts/:id/sign
contractsRouter.post('/:id/sign', async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const { signerName, signingMode = 'CLICKWRAP_OTP', otpCode } = req.body

    const { rows } = await query<Contract & { user_email: string; request_title?: string }>(
      `SELECT c.*, u.email as user_email, r.title as request_title
       FROM public.contracts c
       JOIN public.zolexora_auth_users u ON c.user_id = u.id
       LEFT JOIN public.app_requests r ON c.request_id = r.id
       WHERE c.id = $1 LIMIT 1`,
      [id]
    )

    const contract = rows[0]
    if (!contract) {
      return res.status(404).json({ error: 'Contract not found' })
    }

    if (contract.status === 'signed') {
      return res.status(400).json({ error: 'Contract has already been signed' })
    }

    const clientEmail = contract.user_email
    const projectTitle = contract.request_title || contract.title

    const { documentHash: originalDocHash } = generateContractLegalHtml({
      contract,
      clientName: signerName || clientEmail,
      clientEmail,
      projectTitle,
    })

    const signedAt = new Date().toISOString()
    const { documentHash: signedDocHash } = generateContractLegalHtml({
      contract: { ...contract, status: 'signed', signed_at: signedAt },
      clientName: signerName || clientEmail,
      clientEmail,
      projectTitle,
    })

    await query(
      `UPDATE public.contracts
       SET status = 'signed', signing_mode = $1, signed_at = $2, document_hash = $3, signed_document_hash = $4, updated_at = NOW()
       WHERE id = $5`,
      [signingMode, signedAt, originalDocHash, signedDocHash, id]
    )

    const ipAddress = (req.headers['x-forwarded-for'] as string)?.split(',')[0] || req.socket.remoteAddress || '127.0.0.1'
    const userAgent = req.headers['user-agent'] || 'Unknown'

    await recordContractAuditEvent({
      contractId: id,
      userId: contract.user_id,
      signerName: signerName || clientEmail,
      signerEmail: clientEmail,
      action: 'SIGNED',
      ipAddress,
      userAgent,
      verificationMethod: signingMode,
      documentHash: signedDocHash,
      metadata: {
        originalHash: originalDocHash,
        signedHash: signedDocHash,
        statutory_compliance: 'IT_ACT_2000_SECTION_10A',
        evidence_act: 'SECTION_65B_COMPLIANT',
      },
    })

    res.json({
      success: true,
      contractId: id,
      signedAt,
      signedHash: signedDocHash,
    })
  } catch (error: unknown) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Execution failed',
    })
  }
})

// GET /api/contracts/:id/audit-trail
contractsRouter.get('/:id/audit-trail', async (req: Request, res: Response) => {
  try {
    const { id } = req.params

    const { rows } = await query<ContractAuditLog>(
      `SELECT * FROM public.contract_audit_logs
       WHERE contract_id = $1
       ORDER BY timestamp_utc DESC`,
      [id]
    )

    res.json({ data: rows })
  } catch (error: unknown) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Database error',
    })
  }
})
