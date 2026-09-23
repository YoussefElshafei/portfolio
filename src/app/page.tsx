import { Hero } from "@/components/sections/hero";
import { About } from "@/components/sections/about";
import { Skills } from "@/components/sections/skills";
import { Work } from "@/components/sections/work";
import { Experience } from "@/components/sections/experience";
import { Involvement } from "@/components/sections/involvement";
import { Contact } from "@/components/sections/contact";

/**
 * Section order follows the order the content was supplied in. Every section
 * here is a Server Component; the only client code on the page is the graph
 * and the two entrance-animation wrappers.
 */
export default function Home() {
  return (
    <>
      <Hero />
      <About />
      <Work />
      <Skills />
      <Experience />
      <Involvement />
      <Contact />
    </>
  );
}
