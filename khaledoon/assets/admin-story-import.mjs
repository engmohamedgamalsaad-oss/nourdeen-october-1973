import { storyToLegacy, storyToAdminDraft, normalizeStoryFormat, STORY_FORMAT } from '../../rebuild/adapters/story-package-adapter.mjs?v=20261102-story-package-adapter-3';
import { validateForAdminBridge, validateStory as validateCanonicalStory } from '../../rebuild/validate-story.mjs?v=20261102-story-package-adapter-3';

window.KHStoryAdapter = {
  STORY_FORMAT,
  storyToLegacy,
  storyToAdminDraft,
  normalizeStoryFormat: function (story) { return normalizeStoryFormat(story); },
  validateStory: function (story) { try { return validateCanonicalStory(normalizeStoryFormat(story)); } catch (error) { return [error.message || 'Invalid story package']; } },
  validateForAdminBridge: function (story) { try { return validateForAdminBridge(normalizeStoryFormat(story)); } catch (error) { return [error.message || 'Invalid story package']; } }
};

