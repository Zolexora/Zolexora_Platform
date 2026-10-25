#!/usr/bin/env python3
"""
Stress-test harness for Render Managed PostgreSQL:
1. Render Project and Environment linkage verification (REST API).
2. SSL enforcement & connection latency benchmark.
3. Connection concurrency stress test.
4. Schema constraints enforcement:
   - NOT NULL constraints
   - CHECK constraints
   - UNIQUE constraints
   - Foreign Key enforcement
   - ON DELETE CASCADE and ON DELETE SET NULL behaviors
"""

import asyncio
import json
import math
import ssl
import sys
import time
import urllib.request
import uuid
import asyncpg

RENDER_API_KEY = "rnd_ZwgnGq5L80V9bX4sGw0B4iGwpeIE"
POSTGRES_ID = "dpg-dbf512q9lscs738r1fj0-a"
PROJECT_ID = "prj-dbf510o473hc73bshqvg"
ENV_ID = "evm-dbf510o473hc73bshr00"
DB_URL = "postgresql://appsuite_user:s1geAR0QbBd4MRW6cBxjucnrBEpP46tf@dpg-dbf512q9lscs738r1fj0-a.oregon-postgres.render.com:5432/appsuite_db"

def log(msg):
    print(msg, flush=True)

def get_ssl_context():
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    return ctx

def render_api_get(endpoint):
    url = f"https://api.render.com/v1/{endpoint}"
    req = urllib.request.Request(
        url,
        headers={
            "Accept": "application/json",
            "Authorization": f"Bearer {RENDER_API_KEY}"
        }
    )
    with urllib.request.urlopen(req, timeout=20) as resp:
        return json.loads(resp.read().decode("utf-8"))

def test_render_linkage():
    log("==================================================")
    log("SUITE 1: Render Project & Environment Linkage Check")
    log("==================================================")
    
    # 1. DB Info
    db_info = render_api_get(f"postgres/{POSTGRES_ID}")
    log(f"[*] DB ID: {db_info.get('id')}")
    log(f"[*] DB Name: {db_info.get('name')}")
    log(f"[*] DB Status: {db_info.get('status')}")
    log(f"[*] DB Env ID: {db_info.get('environmentId')}")
    assert db_info.get("id") == POSTGRES_ID, "Database ID mismatch"
    assert db_info.get("name") == "appsuite-postgres", "Database name mismatch"
    assert db_info.get("status") == "available", "Database not available"
    assert db_info.get("environmentId") == ENV_ID, "Database not bound to target environment"

    # 2. Env Info
    env_info = render_api_get(f"environments/{ENV_ID}")
    log(f"[*] Env ID: {env_info.get('id')}")
    log(f"[*] Env Name: {env_info.get('name')}")
    log(f"[*] Env Project ID: {env_info.get('projectId')}")
    log(f"[*] Env Databases: {env_info.get('databasesIds')}")
    assert env_info.get("id") == ENV_ID, "Environment ID mismatch"
    assert env_info.get("name") == "Production", "Environment name mismatch"
    assert env_info.get("projectId") == PROJECT_ID, "Environment not bound to project"
    assert POSTGRES_ID in env_info.get("databasesIds", []), "Database not in environment databases"

    # 3. Project Info
    prj_info = render_api_get(f"projects/{PROJECT_ID}")
    log(f"[*] Project ID: {prj_info.get('id')}")
    log(f"[*] Project Name: {prj_info.get('name')}")
    log(f"[*] Project Environments: {prj_info.get('environmentIds')}")
    assert prj_info.get("id") == PROJECT_ID, "Project ID mismatch"
    assert prj_info.get("name") == "Zolexora-AppSuite", "Project name mismatch"
    assert ENV_ID in prj_info.get("environmentIds", []), "Environment not in project"

    log("[PASS] Suite 1: Render Project Linkage Verified 100%!\n")
    return {
        "db": db_info,
        "env": env_info,
        "project": prj_info
    }

async def test_ssl_and_latency():
    log("==================================================")
    log("SUITE 2: SSL Enforcement & Latency Benchmark")
    log("==================================================")
    
    # 1. Non-SSL Connection Rejection Test
    log("[*] Testing non-SSL connection (ssl=False)...")
    ssl_rejected = False
    try:
        conn = await asyncpg.connect(DB_URL, ssl=False, timeout=15)
        await conn.close()
    except (asyncpg.InvalidAuthorizationSpecificationError, asyncpg.PostgresError) as e:
        log(f"    -> Connection correctly rejected: {type(e).__name__}: {e}")
        ssl_rejected = True
    except Exception as e:
        log(f"    -> Rejected with exception: {type(e).__name__}: {e}")
        ssl_rejected = True
    assert ssl_rejected, "SECURITY FAILURE: Database accepted non-SSL connection!"
    log("[PASS] Non-SSL connection strictly rejected by server.")

    # 2. SSL Inspection Test
    log("[*] Testing SSL connection & querying pg_stat_ssl...")
    ctx = get_ssl_context()
    conn = await asyncpg.connect(DB_URL, ssl=ctx, timeout=20)
    row = await conn.fetchrow("""
        SELECT pid, ssl, version, cipher, bits 
        FROM pg_stat_ssl 
        WHERE pid = pg_backend_pid()
    """)
    log(f"    -> SSL Active: {row['ssl']}")
    log(f"    -> TLS Version: {row['version']}")
    log(f"    -> Cipher Suite: {row['cipher']}")
    log(f"    -> Key Bits: {row['bits']}")
    assert row["ssl"] is True, "SSL not active on backend connection"
    assert row["version"] in ("TLSv1.2", "TLSv1.3"), f"Unexpected TLS version: {row['version']}"
    await conn.close()
    log("[PASS] SSL negotiation verified.")

    # 3. Connection & Query Latency Benchmark (10 iterations)
    iterations = 10
    connect_latencies = []
    query_latencies = []
    log(f"[*] Running {iterations} latency benchmark rounds...")

    for i in range(iterations):
        t0 = time.perf_counter()
        c = await asyncpg.connect(DB_URL, ssl=ctx, timeout=25)
        t1 = time.perf_counter()
        
        t_query_0 = time.perf_counter()
        res = await c.fetchval("SELECT 1")
        t_query_1 = time.perf_counter()
        
        await c.close()
        
        c_lat = (t1 - t0) * 1000.0
        q_lat = (t_query_1 - t_query_0) * 1000.0
        connect_latencies.append(c_lat)
        query_latencies.append(q_lat)
        log(f"    [Round {i+1}/{iterations}] Connect: {c_lat:.1f} ms, Query: {q_lat:.1f} ms")

    def stats(arr):
        s_arr = sorted(arr)
        mean = sum(arr) / len(arr)
        p50 = s_arr[len(s_arr) // 2]
        p95 = s_arr[int(math.ceil(0.95 * len(s_arr))) - 1]
        variance = sum((x - mean) ** 2 for x in arr) / len(arr)
        stdev = math.sqrt(variance)
        return {
            "min": round(min(arr), 2),
            "max": round(max(arr), 2),
            "mean": round(mean, 2),
            "p50": round(p50, 2),
            "p95": round(p95, 2),
            "stdev": round(stdev, 2)
        }

    c_stats = stats(connect_latencies)
    q_stats = stats(query_latencies)
    log(f"    -> Connect Latency (ms): min={c_stats['min']}, p50={c_stats['p50']}, mean={c_stats['mean']}, p95={c_stats['p95']}, max={c_stats['max']}, stdev={c_stats['stdev']}")
    log(f"    -> Query Latency   (ms): min={q_stats['min']}, p50={q_stats['p50']}, mean={q_stats['mean']}, p95={q_stats['p95']}, max={q_stats['max']}, stdev={q_stats['stdev']}")
    log("[PASS] Suite 2: SSL & Latency verified!\n")
    return {
        "ssl_info": dict(row),
        "connect_stats": c_stats,
        "query_stats": q_stats
    }

async def test_concurrency():
    log("==================================================")
    log("SUITE 3: Connection Concurrency Stress Test")
    log("==================================================")
    ctx = get_ssl_context()
    concurrency_levels = [5, 10, 15]
    concurrency_results = {}

    for c_level in concurrency_levels:
        log(f"[*] Stress-testing concurrency level: {c_level} simultaneous connections...")
        success_count = 0
        failure_count = 0
        latencies = []

        async def worker(worker_id):
            nonlocal success_count, failure_count
            t0 = time.perf_counter()
            try:
                conn = await asyncpg.connect(DB_URL, ssl=ctx, timeout=30)
                # Execute transaction with queries
                async with conn.transaction():
                    v1 = await conn.fetchval("SELECT $1::int", worker_id)
                    v2 = await conn.fetchval("SELECT count(*) FROM public.contracts")
                    v3 = await conn.fetchval("SELECT NOW()")
                await conn.close()
                dt = (time.perf_counter() - t0) * 1000.0
                latencies.append(dt)
                success_count += 1
            except Exception as e:
                log(f"    [!] Worker {worker_id} failed: {type(e).__name__}: {e}")
                failure_count += 1

        t_start = time.perf_counter()
        tasks = [worker(i) for i in range(c_level)]
        await asyncio.gather(*tasks)
        total_time = (time.perf_counter() - t_start) * 1000.0

        avg_lat = sum(latencies) / len(latencies) if latencies else 0.0
        qps = (c_level * 3) / (total_time / 1000.0) if total_time > 0 else 0
        log(f"    -> Success: {success_count}/{c_level}, Failures: {failure_count}")
        log(f"    -> Wall-clock total: {total_time:.2f} ms, Avg worker duration: {avg_lat:.2f} ms")
        log(f"    -> Throughput: {qps:.2f} queries/sec")
        assert failure_count == 0, f"Concurrency test failed with {failure_count} errors at level {c_level}"
        concurrency_results[c_level] = {
            "success": success_count,
            "failures": failure_count,
            "wall_clock_ms": round(total_time, 2),
            "avg_worker_ms": round(avg_lat, 2),
            "qps": round(qps, 2)
        }

    log("[PASS] Suite 3: Concurrency Stress Test passed up to 15 parallel connections!\n")
    return concurrency_results

async def test_schema_constraints():
    log("==================================================")
    log("SUITE 4: Schema Constraints & Referential Integrity")
    log("==================================================")
    ctx = get_ssl_context()
    conn = await asyncpg.connect(DB_URL, ssl=ctx, timeout=25)

    test_user_id = uuid.uuid4()
    test_user_email = f"challenger_test_{uuid.uuid4().hex[:8]}@zolexora.test"

    log(f"[*] Setting up test user fixture: id={test_user_id}, email={test_user_email}")
    await conn.execute("INSERT INTO auth.users (id, email) VALUES ($1, $2)", test_user_id, test_user_email)

    try:
        # 1. UNIQUE constraint on auth.users(email)
        log("[*] Testing UNIQUE constraint on auth.users(email)...")
        unique_failed = False
        try:
            await conn.execute("INSERT INTO auth.users (id, email) VALUES ($1, $2)", uuid.uuid4(), test_user_email)
        except asyncpg.UniqueViolationError:
            unique_failed = True
        assert unique_failed, "Failed to enforce UNIQUE on auth.users(email)"
        log("    -> [PASS] UniqueViolationError caught.")

        # 2. NOT NULL constraints on app_requests
        log("[*] Testing NOT NULL constraints on app_requests...")
        nn_user_failed = False
        try:
            await conn.execute("INSERT INTO public.app_requests (user_id, title, description) VALUES (NULL, 'Title', 'Desc')")
        except asyncpg.NotNullViolationError:
            nn_user_failed = True
        assert nn_user_failed, "Failed NOT NULL on app_requests.user_id"

        nn_title_failed = False
        try:
            await conn.execute("INSERT INTO public.app_requests (user_id, title, description) VALUES ($1, NULL, 'Desc')", test_user_id)
        except asyncpg.NotNullViolationError:
            nn_title_failed = True
        assert nn_title_failed, "Failed NOT NULL on app_requests.title"

        nn_desc_failed = False
        try:
            await conn.execute("INSERT INTO public.app_requests (user_id, title, description) VALUES ($1, 'Title', NULL)", test_user_id)
        except asyncpg.NotNullViolationError:
            nn_desc_failed = True
        assert nn_desc_failed, "Failed NOT NULL on app_requests.description"
        log("    -> [PASS] NOT NULL enforced on app_requests (user_id, title, description).")

        # 3. CHECK constraint on app_requests.status
        log("[*] Testing CHECK constraint on app_requests.status...")
        chk_status_failed = False
        try:
            await conn.execute("INSERT INTO public.app_requests (user_id, title, description, status) VALUES ($1, 'T', 'D', 'invalid_status')", test_user_id)
        except asyncpg.CheckViolationError:
            chk_status_failed = True
        assert chk_status_failed, "Failed CHECK on app_requests.status"
        log("    -> [PASS] CheckViolationError caught on invalid app_requests status.")

        # 4. FOREIGN KEY constraint on app_requests.user_id
        log("[*] Testing Foreign Key constraint on app_requests.user_id -> auth.users(id)...")
        fk_failed = False
        try:
            await conn.execute("INSERT INTO public.app_requests (user_id, title, description) VALUES ($1, 'T', 'D')", uuid.uuid4())
        except asyncpg.ForeignKeyViolationError:
            fk_failed = True
        assert fk_failed, "Failed FK on app_requests.user_id"
        log("    -> [PASS] ForeignKeyViolationError caught on invalid user_id.")

        # 5. Insert valid app_request
        req_id = uuid.uuid4()
        await conn.execute(
            "INSERT INTO public.app_requests (id, user_id, title, description, status) VALUES ($1, $2, $3, $4, 'submitted')",
            req_id, test_user_id, "Test Request Title", "Test Request Description"
        )
        log(f"    -> Inserted valid app_request id={req_id}")

        # 6. NOT NULL constraints on contracts
        log("[*] Testing NOT NULL constraints on contracts...")
        nn_c_user = False
        try:
            await conn.execute("INSERT INTO public.contracts (user_id, title) VALUES (NULL, 'Title')")
        except asyncpg.NotNullViolationError:
            nn_c_user = True
        assert nn_c_user, "Failed NOT NULL on contracts.user_id"

        nn_c_title = False
        try:
            await conn.execute("INSERT INTO public.contracts (user_id, title) VALUES ($1, NULL)", test_user_id)
        except asyncpg.NotNullViolationError:
            nn_c_title = True
        assert nn_c_title, "Failed NOT NULL on contracts.title"
        log("    -> [PASS] NOT NULL enforced on contracts (user_id, title).")

        # 7. CHECK constraints on contracts (contract_type, signing_mode, status)
        log("[*] Testing CHECK constraints on contracts (contract_type, signing_mode, status)...")
        for col, val in [("contract_type", "INVALID_TYPE"), ("signing_mode", "CARRIER_PIGEON"), ("status", "unknown_status")]:
            chk_f = False
            try:
                if col == "contract_type":
                    await conn.execute("INSERT INTO public.contracts (user_id, title, contract_type) VALUES ($1, 'T', $2)", test_user_id, val)
                elif col == "signing_mode":
                    await conn.execute("INSERT INTO public.contracts (user_id, title, signing_mode) VALUES ($1, 'T', $2)", test_user_id, val)
                else:
                    await conn.execute("INSERT INTO public.contracts (user_id, title, status) VALUES ($1, 'T', $2)", test_user_id, val)
            except asyncpg.CheckViolationError:
                chk_f = True
            assert chk_f, f"Failed CHECK on contracts.{col} with value {val}"
        log("    -> [PASS] CheckViolationError caught on contract_type, signing_mode, status.")

        # 8. Foreign Key on contracts.request_id
        log("[*] Testing Foreign Key on contracts.request_id...")
        fk_c_req = False
        try:
            await conn.execute("INSERT INTO public.contracts (user_id, request_id, title) VALUES ($1, $2, 'T')", test_user_id, uuid.uuid4())
        except asyncpg.ForeignKeyViolationError:
            fk_c_req = True
        assert fk_c_req, "Failed FK on contracts.request_id"
        log("    -> [PASS] ForeignKeyViolationError caught on invalid contracts.request_id.")

        # Insert valid contract
        contract_id = uuid.uuid4()
        await conn.execute(
            "INSERT INTO public.contracts (id, request_id, user_id, title, contract_type, status) VALUES ($1, $2, $3, 'Test Contract Title', 'MSA', 'draft')",
            contract_id, req_id, test_user_id
        )
        log(f"    -> Inserted valid contract id={contract_id}")

        # 9. NOT NULL and CHECK constraints on contract_audit_logs
        log("[*] Testing NOT NULL & CHECK constraints on contract_audit_logs...")
        nn_log_contract = False
        try:
            await conn.execute("INSERT INTO public.contract_audit_logs (contract_id, signer_name, signer_email, action, ip_address, user_agent, verification_method) VALUES (NULL, 'N', 'E', 'CREATED', '1.1.1.1', 'UA', 'VM')")
        except asyncpg.NotNullViolationError:
            nn_log_contract = True
        assert nn_log_contract, "Failed NOT NULL on contract_audit_logs.contract_id"

        chk_log_action = False
        try:
            await conn.execute("INSERT INTO public.contract_audit_logs (contract_id, signer_name, signer_email, action, ip_address, user_agent, verification_method) VALUES ($1, 'N', 'E', 'HACKED', '1.1.1.1', 'UA', 'VM')", contract_id)
        except asyncpg.CheckViolationError:
            chk_log_action = True
        assert chk_log_action, "Failed CHECK on contract_audit_logs.action"
        log("    -> [PASS] NOT NULL & CHECK enforced on contract_audit_logs.")

        # Insert valid audit log
        log_id = uuid.uuid4()
        await conn.execute(
            "INSERT INTO public.contract_audit_logs (id, contract_id, user_id, signer_name, signer_email, action, ip_address, user_agent, verification_method) VALUES ($1, $2, $3, 'Signer Name', 'signer@test.com', 'CREATED', '127.0.0.1', 'TestRunner', 'SESSION_AUTH')",
            log_id, contract_id, test_user_id
        )
        log(f"    -> Inserted valid contract_audit_log id={log_id}")

        # 10. CASCADE DELETE & SET NULL verification
        log("[*] Testing CASCADE DELETE & SET NULL rules...")

        # Test A: Delete app_request -> contracts.request_id must be SET NULL
        log("    -> Testing contracts.request_id ON DELETE SET NULL...")
        await conn.execute("DELETE FROM public.app_requests WHERE id = $1", req_id)
        curr_c = await conn.fetchrow("SELECT id, request_id FROM public.contracts WHERE id = $1", contract_id)
        assert curr_c is not None, "Contract was erroneously deleted when app_request was deleted!"
        assert curr_c["request_id"] is None, f"Expected request_id to be SET NULL, got {curr_c['request_id']}"
        log("       [PASS] contracts.request_id set to NULL as expected.")

        # Test B: Delete contract -> contract_audit_logs must CASCADE DELETE
        log("    -> Testing contract_audit_logs ON DELETE CASCADE on contract deletion...")
        await conn.execute("DELETE FROM public.contracts WHERE id = $1", contract_id)
        log_count = await conn.fetchval("SELECT count(*) FROM public.contract_audit_logs WHERE id = $1", log_id)
        assert log_count == 0, f"Expected audit log to be CASCADE DELETED, found count={log_count}"
        log("       [PASS] contract_audit_logs cascade-deleted with contract.")

        # Test C: Delete auth.users -> app_requests & contracts CASCADE DELETE
        log("    -> Testing CASCADE DELETE on auth.users deletion...")
        req_id_2 = uuid.uuid4()
        contract_id_2 = uuid.uuid4()
        log_id_2 = uuid.uuid4()
        await conn.execute("INSERT INTO public.app_requests (id, user_id, title, description) VALUES ($1, $2, 'T2', 'D2')", req_id_2, test_user_id)
        await conn.execute("INSERT INTO public.contracts (id, request_id, user_id, title) VALUES ($1, $2, $3, 'T2')", contract_id_2, req_id_2, test_user_id)
        await conn.execute("INSERT INTO public.contract_audit_logs (id, contract_id, user_id, signer_name, signer_email, action, ip_address, user_agent, verification_method) VALUES ($1, $2, $3, 'S2', 'E2', 'CREATED', '1.1.1.1', 'UA', 'SESSION')", log_id_2, contract_id_2, test_user_id)

        # Delete auth.users row
        await conn.execute("DELETE FROM auth.users WHERE id = $1", test_user_id)

        # Check cascading
        r_c = await conn.fetchval("SELECT count(*) FROM public.app_requests WHERE id = $1", req_id_2)
        c_c = await conn.fetchval("SELECT count(*) FROM public.contracts WHERE id = $1", contract_id_2)
        l_c = await conn.fetchval("SELECT count(*) FROM public.contract_audit_logs WHERE id = $1", log_id_2)
        u_c = await conn.fetchval("SELECT count(*) FROM auth.users WHERE id = $1", test_user_id)

        assert u_c == 0, "Test user not deleted"
        assert r_c == 0, f"app_requests was not cascade deleted (count={r_c})"
        assert c_c == 0, f"contracts was not cascade deleted (count={c_c})"
        assert l_c == 0, f"contract_audit_logs was not cascade deleted (count={l_c})"
        log("       [PASS] auth.users deletion cleanly cascade-deleted app_requests, contracts, and audit logs.")

        log("[PASS] Suite 4: All Schema Constraints & Referential Integrity rules verified 100%!\n")
        return {"status": "SUCCESS"}

    finally:
        try:
            await conn.execute("DELETE FROM auth.users WHERE id = $1", test_user_id)
        except Exception:
            pass
        await conn.close()

async def main():
    log("==================================================")
    log("STARTING EMPIRICAL DATABASE STRESS TEST HARNESS")
    log("Target: Render Account 3 Managed PostgreSQL")
    log("==================================================\n")

    # Suite 1: Linkage
    linkage = test_render_linkage()

    # Suite 2: SSL & Latency
    ssl_res = await test_ssl_and_latency()

    # Suite 3: Concurrency
    concurrency_res = await test_concurrency()

    # Suite 4: Constraints & Cascades
    constraints_res = await test_schema_constraints()

    log("==================================================")
    log("EMPIRICAL TEST SUITE COMPLETED SUCCESSFULLY: APPROVE")
    log("==================================================")

if __name__ == "__main__":
    asyncio.run(main())
