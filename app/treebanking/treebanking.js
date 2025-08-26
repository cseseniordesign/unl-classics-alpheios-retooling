
const svg = d3.select("svg");
const width = +svg.attr("width");
const height = +svg.attr("height");
const g = svg.append("g").attr("transform", "translate(50,50)");

// Load JSON data
d3.json("data.json").then(data => {
  const treeLayout = d3.tree().size([height - 300, width - 500]);

  const root = d3.hierarchy(data);
  treeLayout(root);

  // Draw links between nodes
  g.selectAll(".link")
    .data(root.links())
    .join("path")
    .attr("class", "link")
    .attr("fill", "none")
    .attr("stroke", "#999")
    .attr("stroke-width", 2)
    .attr("d", d3.linkHorizontal()
      .x(d => d.y)
      .y(d => d.x)
    );

  const node = g.selectAll(".node")
    .data(root.descendants())
    .join("g")
    .attr("class", "node")
    .attr("transform", d => `translate(${d.y},${d.x})`);

  node.append("circle")
    .attr("r", 6)
    .attr("fill", "#4285f4")
    .attr("stroke", "#333")
    .attr("stroke-width", 1.5);

  node.append("text")
    .attr("dy", 4)
    .attr("x", d => d.children ? -10 : 10)
    .style("text-anchor", d => d.children ? "end" : "start")
    .style("font-size", "14px")
    .text(d => d.data.name);

});
