## Material handoffs
- Keep material packages chapter-scoped with exact source/sample byte hashes and timestamped chapter-language missing inventories, so writers can verify provenance without Cloud credentials.
- Label stored textbook-check passes as checked references rather than human approval; drafts still require owner review and a separate approved import.
- Only export authorized textbook and study content; never include credentials, student data or private reports in repository materials.
- The task queue is the authorized work list: write only `open` tasks whose material call returns stored textbook text, and never write `blocked` chapters from memory or model knowledge.