export default function VyraBackground() {
  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 z-0 overflow-hidden bg-[#020305]"
    >
      {/* =========================================
          BASE ATMOSPHERE
      ========================================= */}

      <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_8%,rgba(50,86,140,0.16),transparent_32%),radial-gradient(circle_at_82%_18%,rgba(207,143,53,0.10),transparent_28%),radial-gradient(circle_at_70%_85%,rgba(46,73,113,0.10),transparent_30%)]" />

      {/* =========================================
          HUGE MAIN VYRA LOGO
      ========================================= */}

      <img
        src="/vyra-logo.jpg"
        alt=""
        draggable={false}
        className="
          vyra-main-logo
          pointer-events-none
          absolute
          left-1/2
          top-[52%]
          w-[1150px]
          max-w-none
          -translate-x-1/2
          -translate-y-1/2
          select-none
          object-contain
          opacity-[0.23]
          mix-blend-screen
        "
      />

      {/* =========================================
          SECOND FLOATING LOGO — TOP RIGHT
      ========================================= */}

      <img
        src="/vyra-logo.jpg"
        alt=""
        draggable={false}
        className="
          vyra-floating-logo
          vyra-floating-logo-1
          pointer-events-none
          absolute
          right-[-170px]
          top-[4%]
          w-[620px]
          max-w-none
          select-none
          object-contain
          opacity-[0.075]
          mix-blend-screen
        "
      />

      {/* =========================================
          THIRD FLOATING LOGO — LEFT BOTTOM
      ========================================= */}

      <img
        src="/vyra-logo.jpg"
        alt=""
        draggable={false}
        className="
          vyra-floating-logo
          vyra-floating-logo-2
          pointer-events-none
          absolute
          left-[-230px]
          bottom-[-80px]
          w-[560px]
          max-w-none
          select-none
          object-contain
          opacity-[0.07]
          mix-blend-screen
        "
      />

      {/* =========================================
          FOURTH FLOATING LOGO — BOTTOM RIGHT
      ========================================= */}

      <img
        src="/vyra-logo.jpg"
        alt=""
        draggable={false}
        className="
          vyra-floating-logo
          vyra-floating-logo-3
          pointer-events-none
          absolute
          right-[4%]
          bottom-[-120px]
          w-[430px]
          max-w-none
          select-none
          object-contain
          opacity-[0.055]
          mix-blend-screen
        "
      />

      {/* =========================================
          BLUE LIGHT
      ========================================= */}

      <div className="absolute left-[24%] top-[18%] h-[260px] w-[260px] rounded-full bg-blue-500/[0.045] blur-[110px]" />

      {/* =========================================
          GOLD LIGHT
      ========================================= */}

      <div className="absolute right-[12%] top-[4%] h-[250px] w-[250px] rounded-full bg-amber-500/[0.055] blur-[110px]" />

      {/* =========================================
          CINEMATIC VIGNETTE
      ========================================= */}

      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_18%,rgba(0,0,0,0.12)_48%,rgba(0,0,0,0.76)_100%)]" />

      {/* =========================================
          TOP → BOTTOM DARK GRADIENT
      ========================================= */}

      <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-black/55" />

      {/* =========================================
          SUBTLE HORIZONTAL LIGHT STREAK
      ========================================= */}

      <div className="absolute left-0 right-0 top-[28%] h-px bg-gradient-to-r from-transparent via-blue-300/[0.07] to-transparent" />

      <div className="absolute left-0 right-0 top-[72%] h-px bg-gradient-to-r from-transparent via-amber-300/[0.045] to-transparent" />

    </div>
  );
}