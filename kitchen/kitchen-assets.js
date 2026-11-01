(function () {
  const flavors = ['strawberry','lemon','milky','chocolate','blueberry'];
  const layers = {};
  const bowls = {};
  const dollops = {};
  for (const flavor of flavors) {
    layers[flavor] = {
      1: `/assets/layers/${flavor}/1.png`,
      2: `/assets/layers/${flavor}/2.png`,
      3: `/assets/layers/${flavor}/3.png`,
      4: `/assets/layers/${flavor}/4.png`
    };
    bowls[flavor] = `/assets/bowls/${flavor}.png`;
    dollops[flavor] = `/assets/dollops/${flavor}.png`;
  }
  window.CAKE_KITCHEN_ASSETS = {
    layers,
    bowls,
    dollops,
    table: '/assets/kitchen/table.png', // optional, otherwise blue table is drawn
    toppings: {
      crimson_cherries: '/assets/toppings/crimson_cherries.png',
      bananas: '/assets/toppings/bananas.png',
      tangy_blueberries: '/assets/toppings/tangy_blueberries.png',
      choco_stars: '/assets/toppings/choco_stars.png',
      star_candies: '/assets/toppings/star_candies.png',
      pawprint_hard_candies: '/assets/toppings/pawprint_hard_candies.png',
      wafer_rolls: '/assets/toppings/wafer_rolls.png',
      jellybeans: '/assets/toppings/jellybeans.png',
      pink_roses: '/assets/toppings/pink_roses.png',
      red_rose_petals: '/assets/toppings/red_rose_petals.png',
      fresh_leaves: '/assets/toppings/fresh_leaves.png'
    },
    // Position of the UNEDITABLE cake image on the logical 960x620 tabletop.
    cakeImage: { x: 270, y: 122, width: 420, height: 414 },
    // Allowed placement region for toppings/cream; adjust if your cake PNG differs.
    decorationArea: { cx: 500, cy: 344, rx: 200, ry: 150 },
    // Custom navigation for your current separate /game and /shop folders.
    gameUrl: '/game.html',
    shopUrl: '/shop.html'
  };
})();
