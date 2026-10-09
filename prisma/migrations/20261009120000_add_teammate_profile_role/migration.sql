-- The seat's role, stored on the profile so an invite raised before any plan exists keeps
-- the role the advisor chose — there is no assignment to hang it on.
--
-- Nullable: every existing profile keeps deriving its role from its assignments, exactly as
-- before. `role` is only the fallback for a membership that has no assignment yet.
ALTER TABLE "TeammateProfile" ADD COLUMN "role" "TeammateAssignmentRole";
