import { storyToLegacy, storyToAdminDraft, STORY_FORMAT } from '../../rebuild/adapters/story-package-adapter.mjs?v=20261101-story-package-adapter-1';
import { validateForAdminBridge, validateStory } from '../../rebuild/validate-story.mjs?v=20261101-story-package-adapter-1';

window.KHStoryAdapter = {
  STORY_FORMAT,
  storyToLegacy,
  storyToAdminDraft,
  validateStory,
  validateForAdminBridge
};

