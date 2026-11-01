import { storyToLegacy, v2ToAdminDraft, STORY_FORMAT } from '../../rebuild/adapters/story-package-adapter.mjs?v=20261031-v2-publisher-1';
import { validateForAdminBridge, validateStory } from '../../rebuild/validate-story.mjs?v=20261031-v2-publisher-1';

window.KHStoryV2Adapter = {
  STORY_FORMAT,
  storyToLegacy,
  v2ToAdminDraft,
  validateV2: validateStory,
  validateForAdminBridge
};
