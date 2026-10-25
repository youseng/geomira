/**
 * What the build says about itself (vite.config.ts defines both): the build id shown in Help
 * and in the version banner (Run 12), and whether this is the single-file build (no service
 * worker; links to the site are absolute). Outside a Vite build (tests) they read as a
 * development build.
 */
declare const __GEOMIRA_BUILD__: string | undefined;
declare const __GEOMIRA_SINGLE_FILE__: boolean | undefined;

export const BUILD: string = typeof __GEOMIRA_BUILD__ === 'string' ? __GEOMIRA_BUILD__ : 'dev';

export const SINGLE_FILE: boolean =
  typeof __GEOMIRA_SINGLE_FILE__ === 'boolean' ? __GEOMIRA_SINGLE_FILE__ : false;

/** The site's address, for links the single file cannot carry (the landing page). */
export const SITE_URL = 'https://youseng.github.io/geomira/';
