-- INSERT INTO public.accounts (id, name, email, "avatarUrl", details) VALUES ('00000000-0000-0000-0000-000000000000', 'Default Agent', 'default@agent.com', '', '{}');
-- INSERT INTO public.rooms (id, "createdAt") VALUES ('00000000-0000-0000-0000-000000000000', NOW());
-- INSERT INTO public.participants (id, "createdAt", "userId", "roomId", "userState", last_message_read) VALUES ('00000000-0000-0000-0000-000000000000', NOW(), 'Default Agent', '00000000-0000-0000-0000-000000000000', NULL, NULL);
-- These two inserts are correct
INSERT INTO public.accounts (id, name, email, "avatarUrl", details) 
VALUES ('00000000-0000-0000-0000-000000000000', 'Default Agent', 'default@agent.com', '', '{}');

INSERT INTO public.rooms (id, "createdAt") 
VALUES ('00000000-0000-0000-0000-000000000000', NOW());

-- This insert needs fixing - userId should be the account's UUID, not the name
INSERT INTO public.participants (id, "createdAt", "userId", "roomId", "userState", last_message_read) 
VALUES (
    '00000000-0000-0000-0000-000000000000',           -- participant id
    NOW(),                                             -- createdAt
    '00000000-0000-0000-0000-000000000000',           -- userId (account UUID, not 'Default Agent')
    '00000000-0000-0000-0000-000000000000',           -- roomId
    NULL,                                              -- userState
    NULL                                               -- last_message_read
);