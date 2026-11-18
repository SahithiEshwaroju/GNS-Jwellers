-- Removes the automated-test accounts (password-based, @gns-test.invalid) and their data.
delete from public.admins where email like '%@gns-test.invalid';
delete from auth.users where email like '%@gns-test.invalid';
-- Rate rows and orders created by automated tests:
delete from public.rate_updates where created_by_email like '%@gns-test.invalid';
-- Orders cannot be deleted through the app (they are cancelled instead); test orders are prefixed "E2E".
delete from public.orders where subject like 'E2E%' and customer_name like 'E2E%';
delete from public.enquiries where customer_name like 'E2E%';
