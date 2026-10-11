import { STORIES, published } from "../content/stories.js";

/* Milestone 6: the story a project names. A CMS project names it by id
   (`storyId`), as the Impact page names stories — one of the CMS's
   published stories, or, while the website's own stories are the site's,
   one of those. Its title and excerpt are the story's own. A website
   project's `story` is its own copy ({ title, excerpt }) and is used as
   written.

   Never silently left out (M15): a story a project names must be one the
   site shows, or the build fails here — content/validate.js says so first
   and the CMS publish refuses it before that. */
export function projectStory(project) {
  if (project.story) return project.story;
  if (!project.storyId) return null;
  const story = STORIES.find((s) => s.id === project.storyId);
  if (!story) throw new Error(`Project "${project.slug}": no story "${project.storyId}" (content/stories.js or the CMS's published stories)`);
  const shown = published().find((s) => s.slug === story.slug);
  if (!shown) throw new Error(`Project "${project.slug}": story "${project.storyId}" is not published`);
  return { title: shown.title, excerpt: shown.excerpt };
}
