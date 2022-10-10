import './style.css';
import {
  getSolidDataset,
  getThing,
  getThingAll,
  getStringNoLocale,
  getResourceInfo,
  getFile,
  overwriteFile,
} from "@inrupt/solid-client";
import { Session } from "@inrupt/solid-client-authn-browser";
import { VCARD } from "@inrupt/vocab-common-rdf";

const solidIdentityProvider = "https://solidcommunity.net";
let userName: string | null = null;

const session = new Session();
const loggedMessage = () => session.info.isLoggedIn && userName != null ? `Logged in as ${userName}` : 'Not logged yet';

// Start login process
async function login() {
  console.debug('Starting log in...');
  if (!session.info.isLoggedIn) {
    await session.login({
      oidcIssuer: solidIdentityProvider,
      clientName: "solid-todo",
      redirectUrl: window.location.href
    });
  }
}

async function logout() {
  if (session.info.isLoggedIn) {
    console.debug('Log out...');
    await session.logout();
    localStorage.clear();
    displayLoginPage();
  }
}


console.debug(`Is logged in: ${session.info.isLoggedIn}`);

async function handleRedirectAfterLogin() {
  await session.handleIncomingRedirect(window.location.href);
  if (session.info.isLoggedIn) {
    console.debug('Logged in, processing pod data');

    const webID = session.info.webId;

    if (webID != null) {
      console.debug(`webId = ${webID}`);

      // The WebID can contain a hash fragment (e.g. `#me`) to refer to profile data
      // in the profile dataset. If we strip the hash, we get the URL of the full
      // dataset.
      const profileDocumentUrl = new URL(webID);
      profileDocumentUrl.hash = "";

      console.debug(`profileDocumentUrl = ${profileDocumentUrl}`);
      // console.debug('profileDocumentUrl', profileDocumentUrl);

      // To write to a profile, you must be authenticated. That is the role of the fetch
      // parameter in the following call.
      let myProfileDataset = await getSolidDataset(profileDocumentUrl.href, {
        fetch: session.fetch
      });

      // The profile data is a "Thing" in the profile dataset.
      let profile = getThing(myProfileDataset, webID);

      if (profile != null) {
        // Get the formatted name (fn) using the property identifier "http://www.w3.org/2006/vcard/ns#fn".
        // VCARD.fn object is a convenience object that includes the identifier string "http://www.w3.org/2006/vcard/ns#fn".
        const formattedName = getStringNoLocale(profile, VCARD.fn);
        if (formattedName != null) {
          userName = formattedName;
          displayLoggedpage();
        }
      }

      console.debug(`userName = ${userName}`);

      // Retrieve public folder
      const PUBLIC_FOLDER = `${profileDocumentUrl.origin}/public/`;

      let publicFolder = await getSolidDataset(PUBLIC_FOLDER, {
        fetch: session.fetch
      });

      let publicContents = await getThingAll(publicFolder);

      console.debug('Public folder contents', publicContents);

      for (const publicContent of publicContents) {
        if (publicContent.url !== PUBLIC_FOLDER) {

          console.debug('publicContent', publicContent);

          const  publicContentResource = await getResourceInfo(publicContent.url, {
            fetch: session.fetch
          });

          console.debug('publicContentResource', publicContentResource);

          const file = await getFile(publicContentResource.internal_resourceInfo.sourceIri, {
            fetch: session.fetch
          });

          console.debug('file', file);

          const content = await file.text();

          console.debug('content', content);

          const regexp = /([0-9]+)/gi

          const newContent = content.replace(regexp, (match, p1) => `${parseInt(p1) + 1}`);

          const savedFile = await overwriteFile(publicContentResource.internal_resourceInfo.sourceIri,
            new Blob([newContent], { type: "plain/text" }),
            { contentType: "text/plain", fetch: session.fetch }
          );

          const savedFileContent = await savedFile.text();
          console.debug('savedFileContent', savedFileContent);
        }
      }
    }
  }
}

function displayLoginPage() {
  document.querySelector<HTMLButtonElement>('#logout')?.removeEventListener('click', logout);
  
  document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
    <div>
      <p>Solid Identity Provider</p>
      <input id="solidProvider" type="text" value="${solidIdentityProvider}">
      <button id="login">Login</button>
    </div>
  `;

  document.querySelector<HTMLButtonElement>('#login')?.addEventListener('click', login);
}

function displayLoggedpage() {
  document.querySelector<HTMLButtonElement>('#login')?.removeEventListener('click', login);

  document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <div>
    <p>${loggedMessage()}</p>
    <button id="logout">Logout</button>
  </div>
`;

  document.querySelector<HTMLButtonElement>('#logout')?.addEventListener('click', logout);
}

if (!session.info.isLoggedIn) {
  handleRedirectAfterLogin();
}

displayLoginPage();
