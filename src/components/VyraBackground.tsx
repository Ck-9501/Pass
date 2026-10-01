export default function VyraBackground(){
  const floatingLogos = [
    { className: 'vyra-float vyra-float-a', size: 'w-[34rem]' },
    { className: 'vyra-float vyra-float-b', size: 'w-[25rem]' },
    { className: 'vyra-float vyra-float-c', size: 'w-[19rem]' },
    { className: 'vyra-float vyra-float-d', size: 'w-[15rem]' },
  ];

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-[#010203]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_12%,rgba(60,91,145,.18),transparent_32%),radial-gradient(circle_at_84%_84%,rgba(189,120,45,.13),transparent_28%)]" />

      <div className="absolute left-[-18vw] top-[8vh] h-[40vw] w-[40vw] rounded-full bg-blue-400/5 blur-[120px]" />
      <div className="absolute right-[-12vw] top-[22vh] h-[36vw] w-[36vw] rounded-full bg-amber-500/5 blur-[120px]" />

      {/* Large signature watermark */}
      <img
        src="/vyra-logo.jpg"
        alt=""
        draggable={false}
        className="vyra-watermark absolute left-1/2 top-[50%] w-[112rem] max-w-none -translate-x-1/2 -translate-y-1/2 select-none object-contain opacity-[0.23] mix-blend-screen"
      />

      {/* Floating VYRA logos */}
      {floatingLogos.map((logo, index) => (
        <img
          key={index}
          src="/vyra-logo.jpg"
          alt=""
          draggable={false}
          className={`${logo.className} ${logo.size} absolute max-w-none select-none object-contain mix-blend-screen`}
        />
      ))}

      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_15%,rgba(0,0,0,.28)_52%,rgba(0,0,0,.9)_100%)]" />
      <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/45" />
      <div className="absolute left-0 right-0 top-[44%] h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_45%,transparent_0%,transparent_35%,rgba(0,0,0,.18)_70%,rgba(0,0,0,.38)_100%)]" />
    </div>
  );
}
