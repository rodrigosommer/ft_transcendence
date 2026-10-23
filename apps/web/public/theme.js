 /* Paints the room before the first frame. The module below is deferred,
         so without this an account that chose dark gets a full white page for
         as long as the bundle takes to parse. Inline, tiny, and it fails soft;
         a browser with site data blocked throws on localStorage and simply
         leaves the stylesheet's own default in place */
{
         try {
        const t = localStorage.getItem('wkb.theme');
        if (t === 'light' || t === 'dark') {
          document.documentElement.setAttribute('data-theme', t);
          document
            .querySelector('meta[name="theme-color"]')
            .setAttribute('content', t === 'dark' ? '#16131c' : '#ece5d3');
        } else if (matchMedia('(prefers-color-scheme: dark)').matches) {
          document.querySelector('meta[name="theme-color"]').setAttribute('content', '#16131c');
        }
      } catch (e) {}
}