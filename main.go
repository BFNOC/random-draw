package main

import (
	"context"
	"embed"
	"errors"
	"flag"
	"fmt"
	"io/fs"
	"log"
	"net"
	"net/http"
	"os/exec"
	"runtime"
	"strings"
	"time"
)

//go:embed web/dist
var embeddedFiles embed.FS

//go:embed VERSION
var embeddedVersion string

var (
	version   = "dev"
	commit    = "unknown"
	buildDate = "unknown"
)

func main() {
	loadEmbeddedVersion()

	addr := flag.String("addr", "127.0.0.1:18080", "HTTP 服务监听地址")
	openBrowser := flag.Bool("open", true, "启动后自动打开浏览器")
	showVersion := flag.Bool("version", false, "输出版本信息")
	flag.Parse()

	if *showVersion {
		fmt.Printf("chouqian %s\ncommit: %s\nbuildDate: %s\n", version, commit, buildDate)
		return
	}

	distFS, err := fs.Sub(embeddedFiles, "web/dist")
	if err != nil {
		log.Fatalf("读取前端构建产物失败: %v", err)
	}

	listener, err := net.Listen("tcp", *addr)
	if err != nil {
		log.Fatalf("监听地址 %s 失败: %v", *addr, err)
	}
	defer listener.Close()

	url := browserURL(listener.Addr())
	server := &http.Server{
		Handler:           cacheControl(http.FileServerFS(distFS)),
		ReadHeaderTimeout: 5 * time.Second,
	}

	if *openBrowser {
		go func() {
			time.Sleep(150 * time.Millisecond)
			if err := openURL(url); err != nil {
				log.Printf("自动打开浏览器失败，请手动访问 %s: %v", url, err)
			}
		}()
	}

	log.Printf("抽签系统 v%s 已启动: %s", version, url)
	if err := server.Serve(listener); err != nil && !errors.Is(err, http.ErrServerClosed) {
		log.Fatalf("HTTP 服务异常退出: %v", err)
	}
}

func loadEmbeddedVersion() {
	if version != "dev" {
		return
	}

	if embedded := strings.TrimSpace(embeddedVersion); embedded != "" {
		version = embedded
	}
}

func cacheControl(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Cache-Control", "no-store")
		next.ServeHTTP(w, r)
	})
}

func browserURL(addr net.Addr) string {
	host, port, err := net.SplitHostPort(addr.String())
	if err != nil {
		return fmt.Sprintf("http://%s/", addr.String())
	}

	if host == "" || host == "::" || host == "0.0.0.0" {
		host = "127.0.0.1"
	}

	return fmt.Sprintf("http://%s/", net.JoinHostPort(host, port))
}

func openURL(url string) error {
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	var cmd *exec.Cmd
	switch runtime.GOOS {
	case "darwin":
		cmd = exec.CommandContext(ctx, "open", url)
	case "windows":
		cmd = exec.CommandContext(ctx, "rundll32", "url.dll,FileProtocolHandler", url)
	default:
		cmd = exec.CommandContext(ctx, "xdg-open", url)
	}

	return cmd.Run()
}
