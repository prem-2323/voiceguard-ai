import argparse
from getpass import getpass

from app.core.database import SessionLocal, init_db
from app.services.bootstrap import create_supervisor_account


def create_supervisor() -> None:
    init_db()
    print("Create a supervisor account for this VoiceGuard installation.")
    name = input("Full name: ").strip()
    worker_id = input("Supervisor account ID: ").strip()
    email = input("Email (optional): ").strip() or None
    password = getpass("Password (at least 12 characters): ")
    confirmation = getpass("Confirm password: ")
    if password != confirmation:
        raise SystemExit("Passwords do not match.")

    try:
        with SessionLocal() as db:
            supervisor = create_supervisor_account(
                db, name=name, worker_id=worker_id, email=email, password=password
            )
    except ValueError as exc:
        raise SystemExit(str(exc)) from exc
    print(f"Supervisor account {supervisor.worker_id} created.")


def main() -> None:
    parser = argparse.ArgumentParser(prog="voiceguard")
    parser.add_argument("command", choices=["create-supervisor"])
    arguments = parser.parse_args()
    if arguments.command == "create-supervisor":
        create_supervisor()


if __name__ == "__main__":
    main()
