update public.card_config
set
  left_sub_header = case when left_sub_header = 'for Construction & Industrial Training' then 'Career Education & Training Institute' else left_sub_header end,
  right_main_header = case when right_main_header = 'GLOBAL SKILLS' then 'OFFICIAL ID' else right_main_header end,
  right_sub_header = case when right_sub_header = 'INSTITUTE' then 'CREDENTIAL' else right_sub_header end,
  back_verification_url = case when back_verification_url = 'www.jayalathcampus.lk/verify' then 'jceti.com/verification' else back_verification_url end,
  back_address = replace(replace(back_address, 'Jayalath Campus for Construction & Industrial Training', 'Jayalath Campus'), 'Industrial Training Road', 'Training Road'),
  back_contact_phone = case when back_contact_phone = '+94 11 2 345 678' then '070 2 503 503' else back_contact_phone end,
  back_contact_email = case when back_contact_email = '+94 77 123 4567' then '011 7 503 503' else back_contact_email end
where id = 1;

update public.students
set
  id_number = case id
    when 'student-1' then 'HMA/FL/FC/2026/000001'
    when 'student-2' then 'HMA/BL/FC/2026/000002'
    when 'student-3' then 'HMA/FL/TT/2026/000003'
    else id_number
  end,
  training_center = case when training_center = 'Global Skills Institute' then 'Jayalath Campus' else training_center end,
  grade = case when card_designation = 'student' then '' else grade end,
  signature_text = case when signature_type = 'typed' and id in ('student-1', 'student-2', 'student-3') then 'Admin Department' else signature_text end
where id in ('student-1', 'student-2', 'student-3')
   or training_center = 'Global Skills Institute'
   or card_designation = 'student';
