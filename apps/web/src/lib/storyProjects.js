/* Whether a story's project reference holds (M31.1) — for
   content/validate.js, which runs only in the build.

     "ok"        no project named, or the project is on the site
     "missing"   the project is not on the site: an error, as always
     "obsolete"  a website story names a website project, but the projects
                 now come from the CMS, so that project is gone. Not the
                 story's fault and not a broken CMS record: a warning, and
                 the story page shows no project link (StoryDetail finds
                 none). A CMS story is never "obsolete" — its project must
                 be published (the snapshot contract checks it too). */
export function storyProjectReference({ projectId, approvedProjectSlugs, storiesFromCms, projectsFromCms }) {
  if (projectId == null || approvedProjectSlugs.has(projectId)) return "ok";
  return projectsFromCms && !storiesFromCms ? "obsolete" : "missing";
}
