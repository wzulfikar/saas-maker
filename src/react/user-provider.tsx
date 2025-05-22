"use client";

// @ts-ignore - React should be provided by the consuming project
import {
	useState,
	useEffect,
	createContext,
	type ReactNode,
	useContext,
} from "react";
import type { AppUser } from "../types";

export type { AppUser }

export type UserContextValue = AppUser & { isLoading?: boolean };

const UserContext = createContext<UserContextValue>({});

type UserProviderProps = {
	children: ReactNode;
	user?: AppUser;
	fetchUser?: () => Promise<AppUser | null | undefined>;
	onAuthListener?: (callback: (userState?: AppUser | null) => void) => () => void;
};

/**
 * Thin wrapper to manage the user state.
 */
export function UserProvider({
	children,
	user,
	onAuthListener,
}: UserProviderProps) {
	const [userState, setUserState] = useState(user || { isLoading: true });

	useEffect(() => {
		let unsubscribe: (() => void) | undefined;
		const initUser = async () => {
			if (onAuthListener) {
				// When authState is null, the user is not authenticated and we assign an empty object
				// so the `id` is empty and the `isLoading` is no longer true.
				unsubscribe = onAuthListener((authState) => {
					setUserState(authState || {});
				});
			}
		};
		initUser();
		return () => unsubscribe?.();
	}, [onAuthListener]);

	return (
		<UserContext.Provider value={userState}>{children}</UserContext.Provider>
	);
}

export function useUser(): UserContextValue {
	const ctx = useContext(UserContext);
	if (!ctx) throw new Error("useUser must be used within a UserProvider");
	return ctx;
}
