-- Removes the automated-test accounts (password-based, @gns-test.invalid) and their data.
delete from public.admins where email like '%@gns-test.invalid';
delete from auth.users where email like '%@gns-test.invalid';
