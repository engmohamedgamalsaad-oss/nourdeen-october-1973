import { v2ToV1, V2_FORMAT } from '../../rebuild/adapters/v1-v2.mjs?v=20261027-v2-admin-5';
import { validateForAdminBridge } from '../../rebuild/validate-story.mjs?v=20261027-v2-admin-5';

window.KHStoryV2Adapter = {
  V2_FORMAT,
  v2ToV1,
  validateForAdminBridge
};
