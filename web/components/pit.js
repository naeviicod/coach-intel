export function Pit() {
  return (
    <div id="atmosphere" className="splash-atmosphere arena art-bg" data-background="orbit" style={{ '--art-zoom': 1.14 }} aria-hidden="true">
      <span className="arena-field arena-field-soft" />
      <span className="arena-field" />
      <span className="arena-hex" />
      <span className="arena-grain" />
      <span className="arena-art">
        <img className="arena-art-img" src="/assets/backgrounds/orbit.png" alt="" draggable="false" />
        <span className="arena-art-tint" aria-hidden="true" />
      </span>
    </div>
  );
}
