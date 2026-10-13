/**
 * Zolexora App Suite - Standard Indian Legal Clause Templates
 * Governing Law: Republic of India (Indian Contract Act 1872, IT Act 2000, Copyright Act 1957)
 */

export interface ContractClause {
  id: string
  title: string
  content: string
  isMandatory: boolean
}

export const INDIAN_LEGAL_CLAUSES: Record<string, ContractClause[]> = {
  MSA: [
    {
      id: 'msa-ip',
      title: '1. Intellectual Property & Condition Precedent of Transfer',
      content:
        'All intellectual property rights, source code, design assets, and documentation created under this Agreement shall remain the exclusive property of Zolexora until 100% of the agreed consideration is received in full. Upon full settlement, Zolexora hereby assigns and transfers all worldwide rights, title, and copyright in the custom deliverable to the Client under Section 19 of the Indian Copyright Act, 1957.',
      isMandatory: true,
    },
    {
      id: 'msa-repo-boundary',
      title: '2. Deployment & Repository Boundary',
      content:
        'The deliverables built by the Zolexora team will be deployed directly to the Client\'s specified cloud infrastructure or pushed to the Client\'s dedicated external git repository. Client acknowledges and agrees that the application codebase is independent of Zolexora\'s core monorepo platform and shall not be maintained or stored within Zolexora\'s internal platform repository.',
      isMandatory: true,
    },
    {
      id: 'msa-warranty',
      title: '3. Warranty, Bug-Fixing & Acceptance Window',
      content:
        'Zolexora provides a 30 (thirty) calendar day warranty period commencing from the formal delivery date. During this period, critical functional bugs reported in writing will be rectified at zero additional charge. Any modification, architectural alteration, or change requests beyond the agreed specifications shall be executed under a separate SOW or AMC.',
      isMandatory: true,
    },
    {
      id: 'msa-jurisdiction',
      title: '4. Governing Law, Stamp Duty & Arbitration',
      content:
        'This Agreement shall be governed by and construed in accordance with the substantive laws of the Republic of India. Any dispute arising out of or in connection with this Agreement shall be referred to arbitration in accordance with the Arbitration and Conciliation Act, 1996, with the seat and venue of arbitration at Mumbai/Pune, Maharashtra, India. Courts located at the seat shall have exclusive jurisdiction.',
      isMandatory: true,
    },
    {
      id: 'msa-digital-validity',
      title: '5. Electronic Execution & Evidentiary Value',
      content:
        'The Parties agree that this Agreement may be executed electronically pursuant to Section 10A of the Information Technology Act, 2000. Electronic signatures, timestamped OTP confirmations, and cryptographically hashed digital records shall be deemed original and fully admissible as electronic evidence under Section 65B of the Indian Evidence Act, 1872.',
      isMandatory: true,
    },
  ],
  SOW: [
    {
      id: 'sow-milestones',
      title: '1. Milestone Schedule & Payment Terms',
      content:
        'Deliverables will be released incrementally according to the milestone chart. Payments are due within 7 (seven) business days of milestone completion notice. Invoices are subject to applicable Goods and Services Tax (GST) in accordance with the Central Goods and Services Tax Act, 2017.',
      isMandatory: true,
    },
    {
      id: 'sow-scope-creep',
      title: '2. Change Management & Out-of-Scope Work',
      content:
        'Features, integrations, or UX modifications not explicitly enumerated in Schedule A (Project Specifications) constitute out-of-scope work. Such requests require a signed Change Order specifying supplementary timeline and commercial impact.',
      isMandatory: true,
    },
  ],
  NDA: [
    {
      id: 'nda-confidentiality',
      title: '1. Protection of Confidential Information & Proprietary Ideas',
      content:
        'Each party agrees to hold in strict confidence all proprietary data, business plans, software architectures, algorithms, and trade secrets disclosed by the other party. Neither party will disclose such information to any third party without prior written consent for a period of 2 (two) years from disclosure.',
      isMandatory: true,
    },
  ],
}
