"use client";

import { useState, useEffect } from "react";
import { Play } from "lucide-react";
import Image from "next/image";
import { AssetProtection } from "../AssetProtection";

const Footer = () => {
  const [showPlayIcon, setShowPlayIcon] = useState(true);
  const [isMuted, setIsMuted] = useState(true);

  // YouTube video ID - replace with your actual video ID
  const videoId = "USi3kH3Filw";

  const handleVideoClick = () => {
    window.open(`https://www.youtube.com/watch?v=${videoId}`, '_blank');
  };

  const toggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsMuted(!isMuted);
  };

  // Hide play icon after 4 seconds
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowPlayIcon(false);
    }, 4000);

    return () => clearTimeout(timer);
  }, []);

  return (
    <AssetProtection>
      <section className="bg-[hsl(var(--about-bg))] text-[hsl(var(--about-text))] min-h-screen">
      {/* Video Section */}
      
      <div className="px-4 pt-8 pb-12 md:px-12 md:pt-12 md:pb-24 lg:px-24 xl:px-32">
        <h2 className="text-4xl md:text-5xl font-bold lg:pl-20 text-left mb-16 text-team-badge-text">
          Check the latest update:
        </h2>
        <div className="max-w-7xl mx-auto">
          <div 
            className="relative w-full aspect-[16/9] md:aspect-[2.5/1] bg-[hsl(var(--about-video-bg))] rounded-2xl md:rounded-3xl overflow-hidden group cursor-pointer"
            onClick={handleVideoClick}
          >
            {/* Video with autoplay */}
            <iframe
              className="absolute inset-0 w-full h-full pointer-events-none protected-video"
              src={`https://www.youtube.com/embed/${videoId}?autoplay=1&mute=${isMuted ? 1 : 0}&controls=0&loop=1&playlist=${videoId}`}
              title="Video player"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />

            {/* Play Button Overlay */}
            {showPlayIcon && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-16 h-16 md:w-20 md:h-20 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center border-2 border-white/40">
                  <Play className="w-6 h-6 md:w-8 md:h-8 text-white fill-white ml-1" />
                </div>
              </div>
            )}

            {/* Mute/Unmute Button */}
            <button
              onClick={toggleMute}
              className="absolute bottom-3 right-3 md:bottom-6 md:right-6 z-10 w-10 h-10 md:w-12 md:h-12 rounded-full bg-white/20 backdrop-blur-sm border-2 border-white/40 flex items-center justify-center hover:bg-white/30 transition-all duration-300"
              aria-label={isMuted ? "Unmute video" : "Mute video"}
            >
              {isMuted ? (
                <svg className="w-5 h-5 md:w-6 md:h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                </svg>
              ) : (
                <svg className="w-5 h-5 md:w-6 md:h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Footer Section */}
      <div className="border-t border-[hsl(var(--about-border))]">
        <div className="px-4 py-12 md:px-12 md:py-16 lg:px-24 xl:px-32">
          <div className="max-w-7xl mx-auto">
            <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-12 lg:gap-8">
              {/* Explore Section */}
              <div>
                <h3 className="text-base md:text-lg font-semibold mb-4 md:mb-6">Explore</h3>
                <ul className="space-y-2 md:space-y-3">
                  <li>
                    <a
                      href="bit.ly/pitchdeck-tempwallets"
                      className="text-white/80 font-light text-sm md:text-base hover:text-white transition-colors"
                    >
                      Information Deck
                    </a>
                  </li>
                 
                  <li>
                    <a
                      href="https://t.me/tempwallets"
                      className="text-white/80 font-light text-sm md:text-base hover:text-white transition-colors"
                    >
                      Community
                    </a>
                  </li>
                  <li>
                    <a
                      href="https://t.me/tempwallets"
                      className="text-white/80 font-light text-sm md:text-base hover:text-white transition-colors"
                    >
                      Contact
                    </a>
                  </li>
                </ul>
              </div>

              {/* Resources Section */}
              <div>
                <h3 className="text-base md:text-lg font-semibold mb-4 md:mb-6">Resources</h3>
                <ul className="space-y-2 md:space-y-3">
                  <li>
                    <a
                      href="bit.ly/whitepaper-tempwallets"
                      className="text-white/80 font-light text-sm md:text-base hover:text-white transition-colors"
                    >
                      Whitepaper
                    </a>
                  </li>
                  <li>
                    <a
                      href="#"
                      className="text-white/80 font-light text-sm md:text-base hover:text-white transition-colors"
                    >
                      Blog
                    </a>
                  </li>
                </ul>
              </div>

              {/* TempWallets Branding Section */}
              <div className="col-span-2 lg:col-span-1">
                <div className="mb-3 md:mb-4">
                  <Image
                    src="/tempwallets-logo.png"
                    alt="TempWallets"
                    width={300}
                    height={80}
                    className="h-[60px] w-[180px] md:h-[60px] md:w-[220px] lg:h-[65px] lg:w-[260px] xl:h-[80px] xl:w-[300px] object-contain"
                    draggable="false"
                  />
                </div>
                <p className="text-white/80 font-light text-xs leading-relaxed mb-4 md:mb-6">
                  TempWallets is the next-generation blockchain platform built to power secure, scalable temporary wallet solutions.
                </p>
                <p className="text-white/80 font-light text-xs">Blockchain Technology Website</p>
              </div>
            </div>

            {/* Bottom Links */}
            <div className="mt-12 md:mt-16 pt-6 md:pt-8 border-t border-[hsl(var(--about-border))] flex flex-col sm:flex-row flex-wrap justify-between items-center gap-4 text-xs md:text-sm text-white/80 font-light">
              <p className="text-center sm:text-right">Copyright © 2025 TempWallets.com </p>
            </div>
          </div>
        </div>
      </div>
    </section>
    </AssetProtection>
  );
};

export default Footer;
