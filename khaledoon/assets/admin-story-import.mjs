import { storyToLegacy, storyToAdminDraft, STORY_FORMAT } from '../../rebuild/adapters/story-package-adapter.mjs?v=20261031-story-publisher-1';
import { validateForAdminBridge, validateStory } from '../../rebuild/validate-story.mjs?v=20261031-story-publisher-1';

window.KHStoryAdapter = {
  STORY_FORMAT,
  storyToLegacy,
  storyToAdminDraft,
  validateStory,
  validateForAdminBridge
};

window.KHStoryV2Adapter = window.KHStoryAdapter; // temporary compatibility alias
window.KHStoryAdapter.validateV2 = window.KHStoryAdapter.validateStory;
