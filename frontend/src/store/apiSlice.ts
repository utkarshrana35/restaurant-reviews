import { createApi } from '@reduxjs/toolkit/query/react';
import type {
  AuthoredReviewDto,
  LoginInput,
  MyReviewDto,
  Paginated,
  PresignedUploadDto,
  PresignUploadInput,
  RegisterInput,
  RequestOtpInput,
  RequestPasswordResetInput,
  ResetPasswordInput,
  RestaurantCreateInput,
  RestaurantDto,
  RestaurantUpdateInput,
  ReviewCreateInput,
  ReviewDto,
  SessionDto,
  SignedInDto,
} from '@restaurant-reviews/common';
import { toQueryString, type ListFilters } from '@/lib/listQuery';
import { sessionHint } from '@/lib/sessionHint';
import { createBaseQuery, rawBaseQuery, refreshSession } from './baseQuery';

/** Every API endpoint the frontend calls, with RTK Query handling caching and refetching. */
export const apiSlice = createApi({
  reducerPath: 'api',
  baseQuery: createBaseQuery((api) => {
    // The session could not be resumed: show the rest of the app that nobody is signed in.
    sessionHint.clear();
    api.dispatch(apiSlice.util.upsertQueryData('getSession', undefined, { user: null }));
  }),
  // A tag names a piece of server data. Queries say which they show, mutations say which they
  // change, and every affected query refetches without being told to individually.
  tagTypes: ['MyRestaurants', 'Restaurant', 'RestaurantList', 'Reviews', 'MyReview', 'MyReviews'],
  endpoints: (build) => ({
    /** Who is signed in, resuming the session first if the access token has lapsed. */
    getSession: build.query<SessionDto, void>({
      async queryFn(_arg, api, extraOptions) {
        const current = await rawBaseQuery('auth/session', api, extraOptions);
        if (current.error) return { error: current.error };

        const session = current.data as SessionDto;
        // Without the sign-in hint there is nothing to resume, so guests make no second request.
        if (session.user || !sessionHint.exists()) return { data: session };

        const refreshed = await refreshSession(api);
        // Could not tell: keep the hint, so the next page load tries to resume again.
        if (refreshed.status === 'failed') return { error: refreshed.error };
        if (refreshed.status === 'ended') {
          sessionHint.clear();
          return { data: { user: null } };
        }
        return { data: { user: refreshed.user } };
      },
    }),

    requestOtp: build.mutation<void, RequestOtpInput>({
      query: (body) => ({ url: 'auth/request-otp', method: 'POST', body }),
    }),

    // A successful sign-in returns the user, which goes straight into the session cache so the
    // rest of the app updates without a second request.
    register: build.mutation<SignedInDto, RegisterInput>({
      query: (body) => ({ url: 'auth/register', method: 'POST', body }),
      async onQueryStarted(_arg, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          sessionHint.set(data.user.role);
          dispatch(apiSlice.util.upsertQueryData('getSession', undefined, data));
        } catch {
          // The form reports the failure through the mutation's own result.
        }
      },
    }),

    login: build.mutation<SignedInDto, LoginInput>({
      query: (body) => ({ url: 'auth/login', method: 'POST', body }),
      async onQueryStarted(_arg, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          sessionHint.set(data.user.role);
          dispatch(apiSlice.util.upsertQueryData('getSession', undefined, data));
        } catch {
          // The form reports the failure through the mutation's own result.
        }
      },
    }),

    requestPasswordReset: build.mutation<void, RequestPasswordResetInput>({
      query: (body) => ({ url: 'auth/password-reset/request', method: 'POST', body }),
    }),

    // Setting the new password also signs the user in, like `login`.
    resetPassword: build.mutation<SignedInDto, ResetPasswordInput>({
      query: (body) => ({ url: 'auth/password-reset/confirm', method: 'POST', body }),
      async onQueryStarted(_arg, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          sessionHint.set(data.user.role);
          dispatch(apiSlice.util.upsertQueryData('getSession', undefined, data));
        } catch {
          // The form reports the failure through the mutation's own result.
        }
      },
    }),

    // The caller reloads the page afterwards, which discards everything cached for the user.
    logout: build.mutation<void, void>({
      query: () => ({ url: 'auth/logout', method: 'POST' }),
      async onQueryStarted(_arg, { queryFulfilled }) {
        try {
          await queryFulfilled;
          sessionHint.clear();
        } catch {
          // Still signed in on the server; keep the hint so the session can be resumed.
        }
      },
    }),

    getMyRestaurants: build.query<RestaurantDto[], void>({
      query: () => 'restaurants/mine',
      providesTags: ['MyRestaurants'],
    }),

    /** One page of the public list. Each filter combination is cached separately. */
    getRestaurants: build.query<Paginated<RestaurantDto>, ListFilters>({
      query: (filters) => `restaurants?${toQueryString(filters)}`,
      providesTags: ['RestaurantList'],
    }),

    getRestaurant: build.query<RestaurantDto, string>({
      query: (id) => `restaurants/${encodeURIComponent(id)}`,
      providesTags: (_result, _error, id) => [{ type: 'Restaurant', id }],
    }),

    /** Permission to upload one image straight to storage. */
    presignImageUpload: build.mutation<PresignedUploadDto, PresignUploadInput>({
      query: (body) => ({ url: 'uploads/presign', method: 'POST', body }),
    }),

    createRestaurant: build.mutation<RestaurantDto, RestaurantCreateInput>({
      query: (body) => ({ url: 'restaurants', method: 'POST', body }),
      invalidatesTags: ['MyRestaurants', 'RestaurantList'],
    }),

    updateRestaurant: build.mutation<RestaurantDto, { id: string; changes: RestaurantUpdateInput }>(
      {
        query: ({ id, changes }) => ({
          url: `restaurants/${encodeURIComponent(id)}`,
          method: 'PATCH',
          body: changes,
        }),
        invalidatesTags: (_result, _error, { id }) => [
          'MyRestaurants',
          'RestaurantList',
          { type: 'Restaurant', id },
        ],
      },
    ),

    deleteRestaurant: build.mutation<void, string>({
      query: (id) => ({ url: `restaurants/${encodeURIComponent(id)}`, method: 'DELETE' }),
      invalidatesTags: (_result, _error, id) => [
        'MyRestaurants',
        'RestaurantList',
        { type: 'Restaurant', id },
      ],
    }),

    /** One page of a restaurant's reviews, newest first. */
    getReviews: build.query<Paginated<ReviewDto>, { restaurantId: string; page: number }>({
      query: ({ restaurantId, page }) =>
        `restaurants/${encodeURIComponent(restaurantId)}/reviews?page=${page}`,
      providesTags: (_result, _error, { restaurantId }) => [{ type: 'Reviews', id: restaurantId }],
    }),

    /** The signed-in reviewer's own review of a restaurant, if any. */
    getMyReview: build.query<MyReviewDto, string>({
      query: (restaurantId) => `restaurants/${encodeURIComponent(restaurantId)}/reviews/mine`,
      providesTags: (_result, _error, restaurantId) => [{ type: 'MyReview', id: restaurantId }],
    }),

    /** The signed-in reviewer's reviews across all restaurants, newest first. */
    getMyReviews: build.query<Paginated<AuthoredReviewDto>, number>({
      query: (page) => `reviews/mine?page=${page}`,
      providesTags: ['MyReviews'],
    }),

    // A review changes the restaurant's average, so the restaurant and the lists showing it
    // refetch too.
    createReview: build.mutation<ReviewDto, { restaurantId: string; review: ReviewCreateInput }>({
      query: ({ restaurantId, review }) => ({
        url: `restaurants/${encodeURIComponent(restaurantId)}/reviews`,
        method: 'POST',
        body: review,
      }),
      invalidatesTags: (_result, _error, { restaurantId }) => reviewChangeTags(restaurantId),
    }),

    deleteReview: build.mutation<void, { id: string; restaurantId: string }>({
      query: ({ id }) => ({ url: `reviews/${encodeURIComponent(id)}`, method: 'DELETE' }),
      invalidatesTags: (_result, _error, { restaurantId }) => reviewChangeTags(restaurantId),
    }),
  }),
});

/** Everything a new or removed review of the restaurant makes out of date. */
function reviewChangeTags(restaurantId: string) {
  return [
    { type: 'Reviews' as const, id: restaurantId },
    { type: 'MyReview' as const, id: restaurantId },
    { type: 'Restaurant' as const, id: restaurantId },
    'RestaurantList' as const,
    'MyRestaurants' as const,
    'MyReviews' as const,
  ];
}

export const {
  useGetSessionQuery,
  useRequestOtpMutation,
  useRegisterMutation,
  useLoginMutation,
  useRequestPasswordResetMutation,
  useResetPasswordMutation,
  useLogoutMutation,
  useGetMyRestaurantsQuery,
  useGetRestaurantsQuery,
  useGetRestaurantQuery,
  usePresignImageUploadMutation,
  useCreateRestaurantMutation,
  useUpdateRestaurantMutation,
  useDeleteRestaurantMutation,
  useGetReviewsQuery,
  useGetMyReviewQuery,
  useGetMyReviewsQuery,
  useCreateReviewMutation,
  useDeleteReviewMutation,
} = apiSlice;
