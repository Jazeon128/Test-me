from sqlalchemy.orm import Session

from app.models.generation_status import GenerationStatus
from app.models.user_progress import UserProgress


def test_three_submissions_persist_history(client, db_session, sample_question):
    for count in range(1, 4):
        response = client.post("/api/progress/submit", json={
            "question_id": sample_question.id,
            "selected_option": "A" if count != 2 else "B",
            "time_taken_seconds": count,
        })
        assert response.status_code == 200
        with Session(db_session.get_bind()) as fresh:
            progress = fresh.query(UserProgress).filter_by(question_id=sample_question.id).one()
            assert progress.times_seen == count
            assert len(progress.attempt_history) == count
            assert [entry["time_seconds"] for entry in progress.attempt_history] == list(range(1, count + 1))
            assert [entry["correct"] for entry in progress.attempt_history] == [True, False, True][:count]


def test_add_log_persists_without_flag_modified(db_session):
    job = GenerationStatus(job_id="persisted-logs")
    db_session.add(job)
    db_session.commit()
    job_id = job.id
    for count in range(1, 4):
        with Session(db_session.get_bind()) as writer:
            writer.get(GenerationStatus, job_id).add_log(f"Line {count}", "info")
            writer.commit()
        with Session(db_session.get_bind()) as fresh:
            logs = fresh.get(GenerationStatus, job_id).logs
            assert [entry["message"] for entry in logs] == [f"Line {i}" for i in range(1, count + 1)]
            assert all(entry["level"] == "info" and entry["timestamp"] for entry in logs)
