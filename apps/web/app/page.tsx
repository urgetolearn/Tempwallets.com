import { LandingPageTracker } from "@/components/analytics/landing-page-tracker";
import Hero from "../components/landing/hero";
import Services from "../components/landing/services";
import About from "../components/landing/about";
import Blogs from "../components/landing/blogs";
import Testimonials from "@/components/landing/testimonials";
import Footer from "@/components/landing/footer";
import Team from "@/components/landing/team";


export default function Home() {
  return (
    <>
      <LandingPageTracker />
      <Hero />
      <Services />
      <About />
      <Blogs />
      <Testimonials />
      <Team />
      <Footer />
    </>
  );
}
