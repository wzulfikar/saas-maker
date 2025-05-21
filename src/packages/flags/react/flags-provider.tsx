"use client";

// @ts-ignore - React should be provided by the consuming project
import {
	useState,
	useEffect,
	createContext,
	type ReactNode,
	useContext,
} from "react";

import { type Flags, type Flag, flags as flagsSingleton } from "../flags";
import { createFlagsFromArrayString } from "../helper";

type FlagsContextValue = {
	flags: Flags;
	isLoading?: boolean;
};

const FlagsContext = createContext<FlagsContextValue>({
	flags: flagsSingleton,
});

type ProviderWithOptions = {
	"posthog-js": {
		token: string;
		api_host?: string;
	} & Record<string, any>;
};

type FlagsProviderProps<T extends keyof ProviderWithOptions> = {
	children: ReactNode;
	userId?: string;
	flags?: Record<string, Flag>;
	fetchFlags?: (userId?: string) => Promise<Record<string, Flag>>;
	fetchFlag?: (flagId: string) => Promise<Flag>;
	provider?: T;
	providerOptions?: T extends "posthog-js" ? ProviderWithOptions[T] : never;
};

export function FlagsProvider<T extends keyof ProviderWithOptions>({
	children,
	fetchFlag,
	fetchFlags,
	provider,
	providerOptions,
	userId,
	flags,
}: FlagsProviderProps<T>) {
	const [isLoading, setIsLoading] = useState(true);

	if (!provider && !fetchFlags && !flags) {
		throw new TypeError(
			"FlagsProvider: Either provider, flags, or fetchFlags must be provided",
		);
	}

	useEffect(() => {
		flagsSingleton.fetchFlag = fetchFlag;
		const initFlags = async () => {
			flagsSingleton.userId = userId;

			if (flags) {
				flagsSingleton.flags = flags;
				setIsLoading(false);
				return;
			}

			try {
				if (fetchFlags) {
					const fetchedFlags = await fetchFlags(userId);
					flagsSingleton.flags = fetchedFlags;
					return;
				}

				// Handle integration for supported providers
				if (provider === "posthog-js") {
					import("posthog-js").then(async (module) => {
						const posthog = module.default;
						if (userId) posthog.identify(userId);
						if (providerOptions) {
							const { token, ...config } = providerOptions;
							posthog.init(token, config);
						}
						posthog.onFeatureFlags((flags) => {
							flagsSingleton.flags = createFlagsFromArrayString(flags);
							setIsLoading(false);
						});
					});
					return;
				}
			} catch (error) {
				console.error(`FlagsProviderClient: Error fetching flags: ${error}`);
				flagsSingleton.flags = {};
			} finally {
				setIsLoading(false);
			}
		};
		initFlags();
	}, [fetchFlags, fetchFlag, userId, flags, provider, providerOptions]);

	return (
		<FlagsContext.Provider value={{ flags: flagsSingleton, isLoading }}>
			{children}
		</FlagsContext.Provider>
	);
}

export function useFlags(): FlagsContextValue {
	const ctx = useContext(FlagsContext);
	if (!ctx) throw new Error("useFlags must be used within a FlagsProvider");
	return ctx;
}
