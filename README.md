# PanasRPG
proyecto no sql 

```
www
├─ conexion github.txt
├─ index.js
├─ package-lock.json
├─ package.json
├─ PanasRPG
│  ├─ assets
│  │  ├─ Items
│  │  │  ├─ 404_item.png
│  │  │  ├─ arco_cazador.png
│  │  │  ├─ arco_draconico.png
│  │  │  ├─ baston_arcano.png
│  │  │  ├─ carbón.png
│  │  │  ├─ ceniza_eterna.png
│  │  │  ├─ cobre.png
│  │  │  ├─ corazon_dragon.png
│  │  │  ├─ corona_helada.png
│  │  │  ├─ cristal_caverna.png
│  │  │  ├─ cristal_comun.png
│  │  │  ├─ cristal_draconico.png
│  │  │  ├─ cristal_helado.png
│  │  │  ├─ cristal_tablero.png
│  │  │  ├─ cuero.png
│  │  │  ├─ cuero_reforzado.png
│  │  │  ├─ daga_sombra.png
│  │  │  ├─ dama_blade.png
│  │  │  ├─ elixir_batalla.png
│  │  │  ├─ escama_draconica.png
│  │  │  ├─ escama_dragon.png
│  │  │  ├─ escarcha.png
│  │  │  ├─ esencia_monstruosa.png
│  │  │  ├─ espada_bosque.png
│  │  │  ├─ espada_hierro.png
│  │  │  ├─ fibra_forestal.png
│  │  │  ├─ fibra_resistente.png
│  │  │  ├─ fragmento_mineral.png
│  │  │  ├─ hacha_batalla.png
│  │  │  ├─ hielo_boreal.png
│  │  │  ├─ hielo_compacto.png
│  │  │  ├─ hierro.png
│  │  │  ├─ hierro_montano.png
│  │  │  ├─ hueso_draconico.png
│  │  │  ├─ jaque_final.png
│  │  │  ├─ lanza_acero.png
│  │  │  ├─ lanza_glacial.png
│  │  │  ├─ madera_ajedrez.png
│  │  │  ├─ madera_viva.png
│  │  │  ├─ manto_ancestral.png
│  │  │  ├─ marfil.png
│  │  │  ├─ martillo_guerra.png
│  │  │  ├─ matadragones.png
│  │  │  ├─ material_cristal_caverna.png
│  │  │  ├─ musgo_guardian.png
│  │  │  ├─ nucleo_real.png
│  │  │  ├─ núcleo_glacial.png
│  │  │  ├─ obsidiana.png
│  │  │  ├─ obsidiana_real.png
│  │  │  ├─ obsidiana_tablero.png
│  │  │  ├─ pico_caverna.png
│  │  │  ├─ piel_boreal.png
│  │  │  ├─ piel_silvestre.png
│  │  │  ├─ pocion_furia.png
│  │  │  ├─ pocion_precision.png
│  │  │  ├─ pocion_reflejos.png
│  │  │  ├─ pocion_vital.png
│  │  │  ├─ raiz_ancestral.png
│  │  │  ├─ resina.png
│  │  │  ├─ rompeescamas.png
│  │  │  └─ semilla_ancestral.png
│  │  ├─ Mapas
│  │  │  ├─ Fondo_Mundo_1.jpg
│  │  │  ├─ Fondo_Mundo_2.jpg
│  │  │  ├─ Fondo_Mundo_3.jpg
│  │  │  ├─ Fondo_Mundo_4.jpg
│  │  │  └─ Fondo_Mundo_5.jpg
│  │  └─ Personajes
│  │     ├─ Enemigos
│  │     └─ Protagonista
│  │        ├─ cristal_caverna_armadura.png
│  │        ├─ cuero_reforzado_armadura.png
│  │        ├─ escama_dragon_armadura.png
│  │        ├─ hielo_boreal_armadura.png
│  │        ├─ hierro_montano_armadura.png
│  │        ├─ manto_ancestral_armadura.png
│  │        ├─ musgo_guardian_armadura.png
│  │        ├─ obsidiana_real_armadura.png
│  │        └─ sin_armadura.png
│  ├─ audio
│  │  ├─ canciones
│  │  │  ├─ musica_cancion_menu.mp3
│  │  │  ├─ musica_musica chill.mp3
│  │  │  └─ musica_musica pelea.mp3
│  │  └─ efectos_de_sonido
│  │     └─ relleno.txt
│  ├─ imagenes
│  │  ├─ 3d
│  │  │  └─ relleno.txt
│  │  ├─ Fondos
│  │  │  ├─ fondo_login.png
│  │  │  ├─ Fondo_registro.jpg
│  │  │  └─ Main_menu.jpg
│  │  ├─ imangenes_MISC
│  │  │  └─ logo.png
│  │  └─ menus
│  │     ├─ batalla
│  │     │  ├─ marco_enemigo.png
│  │     │  └─ marco_heroe.png
│  │     ├─ general
│  │     │  ├─ Boton_cerrar_sesion.png
│  │     │  ├─ Cartel Mercado PNG.png
│  │     │  ├─ Cartel_inventario_armaduras.png
│  │     │  ├─ Cartel_inventario_armas.png
│  │     │  ├─ Cartel_inventario_materiales.png
│  │     │  ├─ Cartel_inventario_pociones.png
│  │     │  ├─ inventario_marco_con_cadenas.png
│  │     │  ├─ inventario_marco_sin_cadenas.png
│  │     │  ├─ Marco_enemigos_ajedrez.png
│  │     │  ├─ Marco_enemigos_bosque.png
│  │     │  ├─ Marco_enemigos_cueva.png
│  │     │  ├─ Marco_enemigos_dragones.png
│  │     │  ├─ Marco_enemigos_nieve.png
│  │     │  ├─ Marco_Info_usuario.png
│  │     │  └─ Marco_items_equipo.png
│  │     ├─ inicio
│  │     │  ├─ boton_login.png
│  │     │  ├─ notienesunacuenta.png
│  │     │  └─ panel_login.png
│  │     └─ registro
│  │        ├─ boton_registrarse.png
│  │        ├─ panel_registro.png
│  │        └─ ya_tienes_cuenta.png
│  ├─ javaScript
│  │  ├─ batalla.js
│  │  ├─ login.js
│  │  ├─ menu.js
│  │  ├─ musicas_js
│  │  │  └─ Musica_menu_registro.js
│  │  ├─ registro.js
│  │  └─ sesion.js
│  ├─ Metodos
│  │  ├─ api.js
│  │  ├─ combate.js
│  │  ├─ dar_items_prueba.js
│  │  ├─ db.js
│  │  └─ seed.js
│  ├─ Nosql
│  │  └─ sistema_completo.json
│  └─ Vistas
│     ├─ Menus
│     │  ├─ inicio
│     │  │  ├─ inicio.css
│     │  │  └─ inicio.html
│     │  └─ Registro
│     │     ├─ registro.css
│     │     └─ registro.html
│     └─ Vistas_generales
│        ├─ Main_batalla.css
│        ├─ Main_batalla.html
│        ├─ Main_game.css
│        ├─ Main_game.html
│        └─ tema.css
└─ README.md

```