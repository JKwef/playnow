"""Integration test: local Supabase only; two independent PostgreSQL connections."""

from concurrent.futures import ThreadPoolExecutor
import subprocess
from threading import Barrier
import uuid

DATABASE_URL = "postgresql://postgres:postgres@127.0.0.1:54322/postgres"
digest = uuid.uuid4().hex.ljust(43, "0")
expired_digest = uuid.uuid4().hex.ljust(43, "0")


def sql(statement):
    return subprocess.run(
        ["psql", DATABASE_URL, "-XAt", "-v", "ON_ERROR_STOP=1", "-c", statement],
        check=True, capture_output=True, text=True,
    ).stdout.strip().splitlines()[-1]


barrier = Barrier(2)


def exchange(_):
    barrier.wait(timeout=10)
    return sql(
        "set role service_role; select public.claim_steam_auth_code("
        f"'{digest}', now() + interval '2 minutes');"
    )


try:
    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(exchange, range(2)))
    assert sorted(results) == ["f", "t"], results
    assert sql(
        f"select public.claim_steam_auth_code('{digest}', now() + interval '2 minutes');"
    ) == "f"
    assert sql(
        f"select public.claim_steam_auth_code('{expired_digest}', now() - interval '1 second');"
    ) == "f"
    print("PASS: one success, one rejection, replay and expired code rejected")
finally:
    sql(f"delete from public.steam_auth_redemptions where code_hash in ('{digest}', '{expired_digest}');")
