// 'use client';

// import type React from "react"
// import { motion } from 'framer-motion';


// const companies = [
//   '/banner-logos/nextjs.png',
//   '/banner-logos/fastapi.png',
//   '/banner-logos/meta.png',
//   '/banner-logos/langgraph.svg',
//   '/banner-logos/twilio.png',
//   '/banner-logos/supabase.svg',
//   '/banner-logos/postgres.png',
//   '/banner-logos/chromadb1.png',

// ];

// export function Banner () {
//   return (
//     <div className="overflow-hidden py-4">
//       <motion.div
//         className="flex"
//         initial={{ x: 0 }}
//         animate={{ x: '-10%' }}
//         transition={{ repeat: Infinity, duration: 10, ease: 'linear' }}
//       >
//         {[...companies, ...companies].map((src, index) => (
//           <img key={index} src={src} alt={`Company ${index + 1}`} className="h-10 w-auto mx-10" />
//         ))}
//       </motion.div>
//     </div>
//   );
// };





'use client';

import type React from "react";

const companies = [
  // '/banner-logos/nextjs.png',
  // '/banner-logos/fastapi.png',
  '/banner-logos/meta.png',
  '/banner-logos/langgraph.svg',
  '/banner-logos/twilio.png',
  '/banner-logos/supabase.svg',
  // '/banner-logos/postgres.png',
  // '/banner-logos/chromadb1.png'
];

export function Banner() {
  return (
    <div className="overflow-hidden py-4 flex justify-center items-center gap-14">
      {companies.map((src, index) => (
        <img key={index} src={src} alt={`Company ${index + 1}`} className="h-10 w-auto" />
      ))}
    </div>
  );
};