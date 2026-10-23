/** Signed-out screens: sign-in, sign-up, onboarding, invitations, the demo and public forms. */
export const auth = {
  layout: {
    tagline: 'Everything your team needs.',
    taglineRest: 'Nothing it doesn’t.',
    openSource: 'Open source and self-hostable',
  },
  email: 'Email',
  password: 'Password',
  signIn: 'Sign in',
  login: {
    checkEmail: 'Check your email',
    linkSent: 'We sent you a sign-in link. Open it in this browser to continue.',
    newHere: 'New to Daiquiri?',
    createAccount: 'Create an account',
    justLooking: 'Just looking?',
    tryDemo: 'Try the demo workspace',
    sendLink: 'Email me a sign-in link',
    linkInstead: 'Use a sign-in link instead',
    passwordInstead: 'Use a password instead',
  },
  signup: {
    confirmTitle: 'Confirm your email',
    /** Around the address, shown in bold. */
    confirmSentTo: 'We sent a confirmation link to',
    confirmOpen: '. Open it to finish creating your account.',
    title: 'Create your account',
    haveAccount: 'Already have an account?',
    name: 'Your name',
    workEmail: 'Work email',
    passwordHint: 'At least 8 characters.',
    submit: 'Create account',
  },
  onboarding: {
    title: 'Set up your workspace',
    name: 'Workspace name',
    namePlaceholder: 'Acme Inc.',
    address: 'Web address',
    slugError: 'Use 2–40 lowercase letters, digits and single dashes.',
    howTeamWorks: 'How does your first team work?',
    teams: {
      software: 'Engineering',
      marketing: 'Marketing',
      operations: 'Operations',
      generic: 'General',
    },
    firstTeam: 'First team',
    /** Followed by sample identifiers: "KEY-1, KEY-2…". */
    numbered: 'Tasks will be numbered',
    submit: 'Create workspace',
  },
  invite: {
    joining: 'Joining workspace',
    unusable: 'This invitation can’t be used',
    unusableHint: 'It may have expired, been revoked, or already been accepted. Ask for a new one.',
    join: (workspace: string) => `Join ${workspace}`,
    /** Followed by the role in bold and the email in brackets. */
    invitedAs: 'You were invited as',
    roles: { owner: 'owner', admin: 'admin', member: 'member', guest: 'guest' },
    accept: 'Accept invitation',
  },
  demo: {
    failed: 'The demo could not start',
    preparing: 'Preparing your demo workspace…',
    about:
      'You’ll get a private copy of a sample company with three teams, projects and tasks. It disappears after 24 hours.',
  },
  intake: {
    unavailable: 'This form isn’t available',
    unavailableHint:
      'The link may be wrong, the form may be closed, or it may only be open to members of its workspace. If you are a member, sign in and open the link again.',
    thanks: 'Thanks, we have it',
    willLook: (team: string, workspace: string, reference: string) =>
      `${team} at ${workspace} will look at it${reference ? `. Your reference is ${reference}.` : '.'}`,
    sendAnother: 'Send another',
    choose: 'Choose…',
    subject: 'Subject',
    details: 'Details',
    urgency: 'How urgent is it?',
    yourEmail: 'Your email',
    emailHint: 'So the team can get back to you. Only they will see it.',
    send: 'Send',
  },
};
