FROM debian:trixie-slim
RUN apt-get update && apt-get install -y --no-install-recommends build-essential ca-certificates curl wget gnupg lsb-release xz-utils zlib1g-dev libssl-dev libffi-dev python3 git && rm -rf /var/lib/apt/lists/*
RUN wget -q https://apt.llvm.org/llvm.sh && chmod +x llvm.sh && ./llvm.sh 21 && apt-get install -y --no-install-recommends clang-21 llvm-21 && rm -rf /var/lib/apt/lists/*
RUN curl -sSLo py.tgz https://www.python.org/ftp/python/3.15.2/Python-3.15.2.tgz && tar xf py.tgz && cd Python-3.15.2 && \
  CC=clang-21 ./configure --enable-experimental-jit=yes-off --prefix=/opt/py && make -j$(nproc) && make install
ENV PATH=/opt/py/bin:$PATH
