package main

import (
	"net"
	"testing"
)

func TestBrowserURLUsesReachableLoopbackForUnspecifiedAddresses(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name string
		addr net.Addr
		want string
	}{
		{
			name: "ipv6 unspecified",
			addr: &net.TCPAddr{IP: net.IPv6zero, Port: 18080},
			want: "http://127.0.0.1:18080/",
		},
		{
			name: "ipv4 unspecified",
			addr: &net.TCPAddr{IP: net.IPv4zero, Port: 18081},
			want: "http://127.0.0.1:18081/",
		},
		{
			name: "ipv4 loopback",
			addr: &net.TCPAddr{IP: net.IPv4(127, 0, 0, 1), Port: 18082},
			want: "http://127.0.0.1:18082/",
		},
		{
			name: "ipv6 loopback",
			addr: &net.TCPAddr{IP: net.IPv6loopback, Port: 18083},
			want: "http://[::1]:18083/",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			if got := browserURL(tt.addr); got != tt.want {
				t.Fatalf("browserURL() = %q, want %q", got, tt.want)
			}
		})
	}
}
