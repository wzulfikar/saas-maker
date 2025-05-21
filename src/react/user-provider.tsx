"use client";

// @ts-ignore - React should be provided by the consuming project
import {
	useState,
	useEffect,
	createContext,
	type ReactNode,
	useContext,
} from "react";

/**
 * The user object returned by the `fetchUser` function. Includes fields for:
 * - unique identifier (`id`)
 * - SaaS related info (`customerId`, `subscriptionPlan`)
 * - common info (`username`, `name`, `email`, `pictureUrl`, `role`)
 * - additional custom info (`metadata`).
 */
export type User = {
	/** Unique identifier for the user. This is the only required property for the user object. */
	id?: string;
	username?: string;
	name?: string;
	email?: string;
	pictureUrl?: string;
	role?: string;
	customerId?: string;
	subscriptionPlan?: string;
	isConfirmed?: boolean;
	metadata?: Record<string, any>;
};

export type UserContextValue = User & { isLoading?: boolean };

const UserContext = createContext<UserContextValue>({});

type UserProviderProps = {
	children: ReactNode;
	user?: User;
	fetchUser?: () => Promise<User>;
	onAuthListener?: (callback: (userState?: User | null) => void) => () => void;
};

export function UserProvider({
	children,
	user,
	fetchUser,
	onAuthListener,
}: UserProviderProps) {
	const [userState, setUserState] = useState(
		user || ({ isLoading: true } as UserContextValue),
	);

	useEffect(() => {
		let unsubscribe: (() => void) | undefined;

		const initUser = async () => {
			if (fetchUser) {
				const fetchedUser = await fetchUser();
				setUserState(fetchedUser);
			}
			if (onAuthListener) {
				unsubscribe = onAuthListener((userState) =>
					setUserState(userState || {}),
				);
			}
		};

		initUser();

		return () => unsubscribe?.();
	}, [fetchUser, onAuthListener]);

	return (
		<UserContext.Provider value={userState}>{children}</UserContext.Provider>
	);
}

export function useUser(): UserContextValue {
	const ctx = useContext(UserContext);
	if (!ctx) throw new Error("useUser must be used within a UserProvider");
	return ctx;
}
