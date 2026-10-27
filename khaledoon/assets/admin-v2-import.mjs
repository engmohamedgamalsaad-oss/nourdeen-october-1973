import { v2ToV1, V2_FORMAT } from '../../rebuild/adapters/v1-v2.mjs?v=20261027-v2-admin-1';
import { validateStory } from '../../rebuild/validate-story.mjs?v=20261027-v2-admin-1';

window.KHStoryV2Adapter = {
  V2_FORMAT,
  v2ToV1,
  validateStory
};
