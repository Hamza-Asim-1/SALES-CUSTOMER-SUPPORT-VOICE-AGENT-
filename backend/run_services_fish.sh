#!/usr/bin/env fish

# Start Auth Service
cd auth-service
fish -c "source venv/bin/activate.fish; uvicorn app.main:app --reload --port 2000" &
cd ..

# Start CRM Service
cd crm_integration_service
fish -c "source .venv/bin/activate.fish; uvicorn app.api.main:app --reload --port 5000 & celery -A app.worrn/arbiter.py", line 608, in spawn_worker
    worker.init_process()
  File "/home/hamza/Desktop/projects/fyp/sales_agent_service/.venv/lib/python3.12/site-packages/gunicorn/workers/base.py", line 135, in init_process
    self.load_wsgi()
  File "/home/hamza/Desktop/projects/fyp/sales_agent_service/.venv/lib/python3.12/site-packages/gunicorn/workers/base.py", line 147, in load_wsgi
    self.wsgi = self.app.wsgi()
                ^^^^^^^^^^^^^^^
  File "/home/hamza/Desktop/projects/fyp/sales_agent_service/.venv/lib/python3.12/site-packages/gunicorn/app/base.py", line 66, in wsgi
    self.callable = self.load()ker.celery_app worker --loglevel=info -P gevent --concurrency=1" &
cd ..

# Start Reporting Service
cd reporting_service
fish -c "source .venv/bin/activate.fish; cd app; uvicorn main:app --reload --port 6000" &
cd ..

# Wait for all processes to finish
wait
