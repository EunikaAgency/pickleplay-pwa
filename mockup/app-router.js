(function () {
  const routes = {
    login: "../login_pickleplay_playful/code.html",
    home: "../home_pickleplay_playful/code.html",
    nearby: "../nearby_pickleplay_playful/code.html",
    games: "../home_pickleplay_playful/code.html#games",
    game: "../game_details_pickleplay_playful/code.html",
    clubs: "../clubs_pickleplay_playful/code.html",
    profile: "../profile_pickleplay_playful/code.html",
  };

  const currentPath = window.location.pathname.toLowerCase();
  const isNearby = currentPath.includes("nearby_pickleplay_playful");
  const isHome = currentPath.includes("home_pickleplay_playful");

  const normalize = (node) => (node.textContent || "").replace(/\s+/g, " ").trim().toLowerCase();

  const routeFromText = (text, node) => {
    if (!text) return "";
    if (text.includes("sign in")) return "home";
    if (text.includes("join the league")) return "home";
    if (text.includes("find courts")) return "nearby";
    if (text.includes("view details")) return "game";
    if (text.includes("see all")) return "games";
    if (text.includes("create club")) return "clubs";
    if (text.includes("create game")) return "game";
    if (text.includes("join game")) return "home";
    if (text.includes("sign out") || text.includes("logout")) return "login";
    if (text.includes("arrow_back")) return "home";

    const inAppNav = Boolean(node && node.closest("nav, footer"));
    if (!inAppNav) return "";

    if (/\bnearby\b/.test(text) || /\blocation_on\b/.test(text)) return "nearby";
    if (/\bclubs\b/.test(text) || /\bgroup\b/.test(text)) return "clubs";
    if (/\bprofile\b/.test(text) || /\bperson\b/.test(text)) return "profile";
    if (/\bgames\b/.test(text) || /\bsports_tennis\b/.test(text)) return "games";
    if (/\bhome\b/.test(text)) return "home";
    return "";
  };

  const navigate = (route) => {
    const target = routes[route] || routes.home;
    window.location.href = target;
  };

  const wireLink = (node) => {
    const text = normalize(node);
    const icon = normalize(node.querySelector(".material-symbols-outlined") || node);
    const route = routeFromText(text, node) || routeFromText(icon, node);
    if (!route) return;

    if (node.tagName === "A") {
      node.href = routes[route] || routes.home;
    }

    node.addEventListener("click", (event) => {
      event.preventDefault();
      navigate(route);
    });
  };

  const wireGameCards = () => {
    if (!isHome) return;

    document.querySelectorAll("section, .group, [class*='rounded']").forEach((node) => {
      const text = normalize(node);
      const looksLikeGame =
        text.includes("beginner open play") ||
        text.includes("rookie rally round") ||
        text.includes("competitive singles") ||
        text.includes("social mixer");

      if (!looksLikeGame) return;
      node.style.cursor = "pointer";
      node.addEventListener("click", (event) => {
        if (event.target.closest("a, button")) return;
        navigate("game");
      });
    });
  };

  const scrollGamesIntoView = () => {
    if (!isHome || window.location.hash !== "#games") return;

    window.setTimeout(() => {
      const heading = Array.from(document.querySelectorAll("h1, h2, h3")).find((node) =>
        /discover games/i.test(node.textContent || "")
      );
      heading?.scrollIntoView({ block: "start", behavior: "smooth" });
    }, 120);
  };

  const init = () => {
    document.querySelectorAll("nav a, footer a, a, button").forEach((node) => {
      if (isNearby && (node.id === "toggle-courts" || node.id === "toggle-games")) return;
      wireLink(node);
    });

    wireGameCards();
    scrollGamesIntoView();
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
