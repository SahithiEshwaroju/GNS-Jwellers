-- PRE-PRODUCTION CLEANUP — run once in the Supabase SQL editor before launch. Review each block first.
-- Removes the automated-test identities and leftovers created during development and the security audit.

-- 1) Test administrator and test accounts (password-based, @gns-test.invalid). These must not exist in production.
delete from public.admins where email like '%@gns-test.invalid';
delete from auth.users   where email like '%@gns-test.invalid';   -- cascades to their profiles / saved designs

-- 2) Cancelled test orders and test enquiries (orders cannot be deleted from the app by design).
delete from public.orders    where subject like 'E2E%' and customer_name like 'E2E%';
delete from public.enquiries where customer_name like 'E2E%';

-- 3) Sample catalogue data (flagged is_sample). Enter real products and rates first, or the site will be empty.
-- delete from public.products where is_sample;
-- delete from public.rate_updates where is_sample;   -- keep any real rate rows; the latest row is the live rate

-- 4) Optional: restart numbering once there are NO real orders/enquiries yet.
-- alter sequence public.order_no_seq restart 1;
-- alter sequence public.enquiry_ref_seq restart 1001;

-- 5) Verify: only real admins remain.
select email, name from public.admins order by email;
