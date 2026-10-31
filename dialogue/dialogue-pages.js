// COOKIE CAKE SHOP: page-by-page dialogue art.
// This file controls POSES and the special Shadow Milk / Pure Vanilla interruption.
// The nine ordinary customers' dialogue text still comes from Supabase, so
// existing admin dialogue editor will continue to work.
(function () {
  const pose = (code, page) => `/assets/characters/${code}/page-${page}.png`;
  const bubble = (code) => `/assets/bubbles/${code}.png`;
  window.CAKE_DIALOGUE_PAGES = {
    customers: {
      silent_salt: [
        { sprite: pose("silent_salt", 1), bubble: bubble("salt1") },
        { sprite: pose("silent_salt", 2), bubble: bubble("salt2") },
        { sprite: pose("silent_salt", 3), bubble: bubble("salt3") },
      ],
      white_lily: [
        { sprite: pose("white_lily", 1), bubble: bubble("lily1") },
        { sprite: pose("white_lily", 2), bubble: bubble("lily2") },
        { sprite: pose("white_lily", 3), bubble: bubble("lily3") },
      ],
      mystic_flour: [
        { sprite: pose("mystic_flour", 1) },
        { sprite: pose("mystic_flour", 2) },
      ],
      dark_cacao: [
        { sprite: pose("dark_cacao", 1) },
        { sprite: pose("dark_cacao", 2) },
      ],
      eternal_sugar: [
        { sprite: pose("eternal_sugar", 1) },
        { sprite: pose("eternal_sugar", 2) },
      ],
      hollyberry: [
        { sprite: pose("hollyberry", 1) },
        { sprite: pose("hollyberry", 2) },
      ],
      burning_spice: [
        { sprite: pose("burning_spice", 1) },
        { sprite: pose("burning_spice", 2) },
      ],
      golden_cheese: [
        { sprite: pose("golden_cheese", 1) },
        { sprite: pose("golden_cheese", 2) },
      ],
      shadow_milk: [{ sprite: pose("shadow_milk", 1) }],
      pure_vanilla: [{ sprite: pose("pure_vanilla", 1) }],
    },

    // ONLY active when both Shadow Milk + Pure Vanilla are the weekly pair.
    // One line = one screen, with independent sprite, bubble and speaker.
    // Pure Vanilla speaks first. Shadow Milk then bursts in and interrupts him.
    shadowMilkInterruption: [
      {
        speaker: "pure_vanilla",
        main: "pure_vanilla",
        from: "order", // Reads Pure Vanilla's editable admin dialogue
        sprite: pose("pure_vanilla", 1),
        bubble: bubble("pure_vanilla"),
        bubbleSide: "left",
      },
      {
        speaker: "pure_vanilla",
        main: "pure_vanilla",
        text: "I hope that will not be too much to prepare...",
        sprite: pose("pure_vanilla", 2),
        bubble: bubble("pure_vanilla"),
        bubbleSide: "left",
      },
      {
        speaker: "shadow_milk",
        main: "shadow_milk",
        companion: "pure_vanilla",
        frontOfDesk: true,
        text: "Aha! WHIM for something VEEERY special~!",
        sprite: pose("shadow_milk", 1),
        companionSprite: pose("pure_vanilla", 3),
        bubble: bubble("shadow_milk"),
        bubbleSide: "right",
        reactionText: "...!",
        reactionBubble: bubble("pure_vanilla"),
      },
      {
        speaker: "shadow_milk",
        main: "shadow_milk",
        companion: "pure_vanilla",
        frontOfDesk: true,
        text: "Two-tier? Four-tier?? WHATEVS-TIER~!",
        sprite: pose("shadow_milk", 2),
        companionSprite: pose("pure_vanilla", 4),
        bubble: bubble("shadow_milk"),
        bubbleSide: "right",
        reactionText: "That does not sound very specific...",
        reactionBubble: bubble("pure_vanilla"),
      },
      {
        speaker: "shadow_milk",
        main: "shadow_milk",
        companion: "pure_vanilla",
        frontOfDesk: true,
        text: "PSH! No need to look at this WIP. Let us top it off with SOMETHING!",
        sprite: pose("shadow_milk", 3),
        companionSprite: pose("pure_vanilla", 5),
        bubble: bubble("shadow_milk"),
        bubbleSide: "right",
        reactionText: "What a hectic demand...",
        reactionBubble: bubble("pure_vanilla"),
      },
      {
        speaker: "shadow_milk",
        main: "shadow_milk",
        companion: "pure_vanilla",
        frontOfDesk: true,
        text: "My actual order? OHOHO... That stays a MYSTERY!",
        sprite: pose("shadow_milk", 4),
        companionSprite: pose("pure_vanilla", 6),
        bubble: bubble("shadow_milk"),
        bubbleSide: "right",
        reactionText: "...",
        reactionBubble: bubble("pure_vanilla"),
      },
    ],
  };
})();
