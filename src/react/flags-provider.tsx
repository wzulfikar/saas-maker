"use client";

// @ts-ignore - React should be provided by the consuming project
import {
	useState,
	useEffect,
	createContext,
	type ReactNode,
	useContext,
} from "react";

import { type Flags, type Flag, flags } from "../flags/flags";

type FlagsContextValue = {
	flags?: Flags;
	isLoading?: boolean;
	isFetching?: boolean;
};

const FlagsContext = createContext<FlagsContextValue>({});

type FlagsProviderProps = {
	children: ReactNode;
	fetchFlags: (userId?: string) => Promise<Record<string, Flag>>;
	fetchFlag?: (flagId: string) => Promise<Flag>;
	userId?: string;
	initialFlags?: Record<string, Flag>;
};

export function FlagsProvider({
	children,
	fetchFlag,
	fetchFlags,
	userId,
	initialFlags,
}: FlagsProviderProps) {
	const [isLoading, setIsLoading] = useState(true);
	const [isFetching, setIsFetching] = useState(true);

	useEffect(() => {
		flags.fetchFlag = fetchFlag;
		const initFlags = async () => {
			flags.userId = userId;
			if (initialFlags) {
				flags.flags = initialFlags;
				setIsLoading(false);
			}

			try {
				const fetchedFlags = await fetchFlags(userId);
				flags.flags = fetchedFlags;
			} catch (error) {
				console.error(`FlagsProviderClient: Error fetching flags: ${error}`);
				flags.flags = {};
			} finally {
				setIsLoading(false);
				setIsFetching(false);
			}
		};
		initFlags();
	}, [fetchFlags, fetchFlag, userId, initialFlags]);

	return (
		<FlagsContext.Provider value={{ flags, isLoading, isFetching }}>
			{children}
		</FlagsContext.Provider>
	);
}

export function useFlags(): FlagsContextValue {
	const ctx = useContext(FlagsContext);
	if (!ctx) throw new Error("useFlags must be used within a FlagsProvider");
	return ctx;
}
