from app.models.generation_status import GenerationStatus


def test_only_warnings_in_order():
    job = GenerationStatus(job_id='fake-warnings')
    for message, level in [('started', 'info'), ('first failure', 'warning'), ('fatal', 'error'), ('second failure', 'warning')]:
        job.add_log(message, level)
    assert job.to_dict()['warnings'] == ['first failure', 'second failure']
    assert len(job.to_dict()['logs']) == 4


def test_no_logs_has_no_warnings():
    assert GenerationStatus(job_id='fake-empty').to_dict()['warnings'] == []
