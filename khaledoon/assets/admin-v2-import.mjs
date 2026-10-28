import { v2ToV1, v2ToAdminDraft, V2_FORMAT } from '../../rebuild/adapters/v1-v2.mjs?v=20261028-v2-admin-6';
import { validateForAdminBridge, validateStory } from '../../rebuild/validate-story.mjs?v=20261028-v2-admin-6';

window.KHStoryV2Adapter = {
  V2_FORMAT,
  v2ToV1,
  v2ToAdminDraft,
  validateV2: validateStory,
  validateForAdminBridge
};
