"use client";

// @ts-ignore - React should be provided by the consuming project
import {
	useState,
	useEffect,
	createContext,
	type ReactNode,
	useContext,
} from "react";

type User = {
	id: string;
	email?: string;
	role?: string;
	customerId?: string;
	subscriptionPlan?: string;
	metadata?: Record<string, string>;
};

type UserContextValue =
	| { id?: undefined; isLoading?: boolean; isFetching?: boolean }
	| User;

const UserContext = createContext<UserContextValue>({});

type UserProviderProps = {
	children: ReactNode;
	fetchUser: () => Promise<User>;
	onChangeListener?: (
		callback: (userState?: User | null) => void,
	) => () => void;
};

export function UserProvider({
	children,
	fetchUser,
	onChangeListener,
}: UserProviderProps) {
	const [user, setUser] = useState({} as UserContextValue);

	useEffect(() => {
		let unsubscribe: (() => void) | undefined;
		const initUser = async () => {
			const fetchedUser = await fetchUser();
			setUser(fetchedUser);
			if (onChangeListener) {
				unsubscribe = onChangeListener((userState) => setUser(userState || {}));
			}
		};
		initUser();

		return () => {
			unsubscribe?.();
		};
	}, [fetchUser, onChangeListener]);

	return <UserContext.Provider value={user}>{children}</UserContext.Provider>;
}

export function useUser(): UserContextValue {
	const ctx = useContext(UserContext);
	if (!ctx) throw new Error("useUser must be used within a UserProvider");
	return ctx;
}
