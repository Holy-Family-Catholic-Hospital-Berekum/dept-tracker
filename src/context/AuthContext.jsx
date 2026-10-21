import { onAuthStateChanged, signInWithEmailAndPassword, signOut as fbSignOut } from 'firebase/auth'
import { doc, getDoc, onSnapshot } from 'firebase/firestore'
import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { logEvent } from '../lib/db'
import { auth, db } from '../lib/firebase'
import { permissionsFor } from '../lib/roles'

const AuthContext = createContext(null)

// status: loading | signedOut | noProfile | inactive | ready
export function AuthProvider({ children }) {
  const [state, setState] = useState({ status: 'loading', user: null, profile: null })

  useEffect(() => {
    let unsubProfile = () => {}
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      unsubProfile()
      if (!user) {
        setState({ status: 'signedOut', user: null, profile: null })
        return
      }
      unsubProfile = onSnapshot(
        doc(db, 'users', user.uid),
        (snap) => {
          if (!snap.exists()) return setState({ status: 'noProfile', user, profile: null })
          const profile = { uid: user.uid, ...snap.data() }
          setState({ status: profile.active ? 'ready' : 'inactive', user, profile })
        },
        () => setState({ status: 'noProfile', user, profile: null }),
      )
    })
    return () => {
      unsubProfile()
      unsubAuth()
    }
  }, [])

  const value = useMemo(() => {
    async function signIn(email, password) {
      const cred = await signInWithEmailAndPassword(auth, email, password)
      const snap = await getDoc(doc(db, 'users', cred.user.uid))
      if (snap.exists() && snap.data().active) {
        const p = snap.data()
        await logEvent({ uid: cred.user.uid, name: p.name, role: p.role }, 'Sign In', `${p.name} signed in.`).catch(() => {})
      }
    }

    async function signOut() {
      if (state.profile) {
        await logEvent(state.profile, 'Sign Out', `${state.profile.name} signed out.`).catch(() => {})
      }
      await fbSignOut(auth)
    }

    return {
      ...state,
      perms: state.profile ? permissionsFor(state.profile.role) : null,
      signIn,
      signOut,
    }
  }, [state])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  return useContext(AuthContext)
}
