PRAGMA foreign_key_check;

SELECT 'employees' AS entity, COUNT(*) AS row_count FROM employees
UNION ALL SELECT 'people', COUNT(*) FROM people
UNION ALL SELECT 'employment_records', COUNT(*) FROM employment_records;

SELECT employee_id, employee_name
FROM employees
WHERE person_id IS NULL OR employment_id IS NULL;

SELECT p.person_id, p.legal_name, COUNT(e.employment_id) AS employment_count
FROM people p
LEFT JOIN employment_records e ON e.person_id = p.person_id
WHERE p.lifecycle_status IN ('employee','former_employee')
GROUP BY p.person_id, p.legal_name
HAVING COUNT(e.employment_id) = 0;

SELECT lower(primary_email) AS duplicate_email, COUNT(*) AS occurrences
FROM people
WHERE primary_email IS NOT NULL
GROUP BY lower(primary_email)
HAVING COUNT(*) > 1;

SELECT employee_id, COUNT(*) AS occurrences
FROM employment_records
GROUP BY employee_id
HAVING COUNT(*) > 1;
