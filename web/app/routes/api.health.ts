export async function loader() {
  return Response.json({
    ok: true,
    service: "phuquoclux-web",
    architecture: "map-first-commerce",
    time: new Date().toISOString(),
  });
}
