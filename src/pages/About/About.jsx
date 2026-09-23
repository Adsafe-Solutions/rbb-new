import PageHero from "../../components/PageHero/PageHero.jsx";
import AboutIntro from "../../components/AboutIntro/AboutIntro.jsx";
import ProjectTimeline from "../../components/ProjectTimeline/ProjectTimeline.jsx";
import useReveal from "../../hooks/useReveal.js";
import { ABOUT } from "../../content/index.js";

/* /about-us: who we are, then what that looks like on the ground. */
export default function About() {
  useReveal();

  return (
    <>
      <PageHero {...ABOUT.hero} />
      <AboutIntro {...ABOUT.intro} />
      <ProjectTimeline {...ABOUT.highlights} />
    </>
  );
}
